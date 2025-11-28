import { WKIM, WKIMChannelType, WKIMEvent } from 'easyjssdk';
import { Message, WuKongIMMessage } from '../types';
import { WuKongIMUtils } from './wukongimApi';
import { CHANNEL_TYPE } from '@/constants';


export interface WuKongIMWebSocketConfig {
  serverUrl: string;
  uid: string;
  token: string;
}

export interface ConnectionStatus {
  isConnected: boolean;
  isConnecting: boolean;
  error?: string;
}

export type MessageHandler = (message: Message) => void;
export type ConnectionStatusHandler = (status: ConnectionStatus) => void;
export type ErrorHandler = (error: any) => void;
export type StreamMessageHandler = (clientMsgNo: string, content: string) => void;
export type StreamEndHandler = (clientMsgNo: string) => void;
export type VisitorPresenceEvent = { visitorId?: string; channelId: string; channelType: number; isOnline: boolean; timestamp?: string | null; eventType: string; raw?: any };
export type VisitorPresenceHandler = (presence: VisitorPresenceEvent) => void;

export type VisitorProfileUpdatedEvent = { visitorId?: string; channelId: string; channelType: number; raw?: any };
export type VisitorProfileUpdatedHandler = (evt: VisitorProfileUpdatedEvent) => void;

/**
 * WuKongIM WebSocket Service Manager
 * Handles real-time messaging through WuKongIM EasySDK-JS
 */
export class WuKongIMWebSocketService {
  private im?: WKIM = undefined;
  private connectionStatus: ConnectionStatus = {
    isConnected: false,
    isConnecting: false,
  };

  // Event handlers
  private messageHandlers: MessageHandler[] = [];
  private connectionStatusHandlers: ConnectionStatusHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  private visitorProfileUpdatedHandlers: VisitorProfileUpdatedHandler[] = [];

  private streamMessageHandlers: StreamMessageHandler[] = [];
  private streamEndHandlers: StreamEndHandler[] = [];
  private visitorPresenceHandlers: VisitorPresenceHandler[] = [];

  // Reconnection timer (for cleanup)
  private reconnectTimer: number | null = null;

  // Prevent multiple simultaneous connection attempts
  private connectionPromise: Promise<void> | null = null;
  private isInitialized = false;

  // Track manual disconnection to prevent unnecessary reconnections
  private manualDisconnect = false;


  /**
   * Initialize the WebSocket connection
   */
  async init(config: WuKongIMWebSocketConfig): Promise<void> {
    // Prevent multiple simultaneous connection attempts
    if (this.connectionPromise) {
      console.log('🔌 Connection attempt already in progress, waiting...');
      return this.connectionPromise;
    }

    // If already connected with same config, skip
    if (this.isInitialized && this.connectionStatus.isConnected) {
      console.log('🔌 Already connected, skipping initialization');
      return;
    }

    this.connectionPromise = this.performConnection(config);

    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  /**
   * Perform actual connection logic
   */
  private async performConnection(config: WuKongIMWebSocketConfig): Promise<void> {
    try {
      console.log('🔌 Starting WebSocket connection...', { uid: config.uid, serverUrl: config.serverUrl });

      // Clean up any existing connection first
      if (this.im) {
        console.log('🔌 Cleaning up existing connection...');
        this.cleanupConnection();
      }

      this.updateConnectionStatus({ isConnecting: true, isConnected: false });
      this.manualDisconnect = false;

      // Initialize WKIM instance with connection timeout
      this.im = WKIM.init(config.serverUrl, {
        uid: config.uid,
        token: config.token
      },{});

      // Setup event listeners
      this.setupEventListeners();

      // Attempt connection with timeout
      const connectionTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), 10000);
      });

      await Promise.race([
        this.im.connect(),
        connectionTimeout
      ]);

      this.isInitialized = true;
      console.log('🔌 WebSocket connection established successfully');
      console.log("im-2----->",this.im)

    } catch (error) {
      console.error('🔌 WebSocket initialization failed:', error);
      this.cleanupConnection();
      this.updateConnectionStatus({
        isConnected: false,
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      });
      this.notifyErrorHandlers(error);
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    console.log('🔌 Manual disconnect requested');
    this.manualDisconnect = true;
    this.cleanupConnection();
  }

  /**
   * Clean up connection resources
   */
  private cleanupConnection(): void {
    console.log('🔌 Cleaning up connection:', {
      hasIM: !!this.im,
      isConnected: this.connectionStatus.isConnected,
      isInitialized: this.isInitialized
    });

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.im) {
      try {
        // Clear event listeners first to prevent any callbacks during disconnect
        this.clearEventListeners();

        // Try to disconnect gracefully, but catch any WebSocket close code errors
        this.im.disconnect();
      } catch (error) {
        // Ignore WebSocket close code errors from the SDK
        if (error instanceof Error && error.message.includes('close code')) {
          console.warn('🔌 WebSocket close code error ignored:', error.message);
        } else {
          console.error('🔌 Error during WebSocket disconnect:', error);
        }
      }
      this.im = undefined;
    }

    this.isInitialized = false;
    // Always update connection status when cleaning up
    this.updateConnectionStatus({ isConnected: false, isConnecting: false });

    console.log('🔌 Connection cleanup completed');
  }

  /**
   * Safe disconnect that avoids SDK close code issues
   */
  safeDisconnect(): void {
    console.log('🔌 Safe disconnect requested:', {
      hasIM: !!this.im,
      isConnected: this.connectionStatus.isConnected,
      isInitialized: this.isInitialized
    });

    this.manualDisconnect = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Clear connection promise to prevent pending connections
    this.connectionPromise = null;

    // Just clear the instance without calling disconnect to avoid close code errors
    if (this.im) {
      // Clear event listeners to prevent any remaining callbacks
      this.clearEventListeners();
      this.im = undefined;
    }

    this.isInitialized = false;
    this.updateConnectionStatus({ isConnected: false, isConnecting: false });

    console.log('🔌 Safe disconnect completed');
  }

  /**
   * Send a message through WebSocket
   */
  async sendMessage(
    channelId: string,
    channelType: number,
    payload: any
  ): Promise<any> {
    console.log('🔌 WebSocket sendMessage called:', {
      hasIM: !!this.im,
      isConnected: this.connectionStatus.isConnected,
      isInitialized: this.isInitialized,
      channelId,
      channelType
    });

    // ENHANCED STATE CONSISTENCY CHECK
    // Check for state inconsistency: connection shows as connected but no IM instance
    if (this.connectionStatus.isConnected && !this.im) {
      console.error('🔌 CRITICAL STATE INCONSISTENCY: isConnected=true but im=null, fixing...');
      this.updateConnectionStatus({ isConnected: false, isConnecting: false });
      this.isInitialized = false;
      throw new Error('WebSocket state inconsistency detected - connection status reset');
    }

    // Check IM instance first
    if (!this.im) {
      // Update connection status to reflect reality
      this.updateConnectionStatus({ isConnected: false, isConnecting: false });
      throw new Error('WebSocket not initialized');
    }

    // Check connection status
    if (!this.connectionStatus.isConnected) {
      throw new Error('WebSocket not connected');
    }

    // Additional check: verify the IM instance is actually connected
    try {
      // Test if the connection is actually alive by checking IM state
      if (this.im.isConnected && typeof this.im.isConnected === 'function') {
        if (!this.im.isConnected) {
          console.log('🔌 IM instance reports not connected, updating status');
          this.updateConnectionStatus({ isConnected: false, isConnecting: false });
          this.im = undefined; // Clear broken instance
          this.isInitialized = false;
          throw new Error('WebSocket connection lost');
        }
      }
    } catch (stateCheckError) {
      // If we can't check state, log but continue with send attempt
      console.warn('🔌 WebSocket state check failed:', stateCheckError);
    }

    try {
      // Convert channel type to WuKongIM format
      const wkimChannelType = this.convertChannelType(channelType);

      console.log('🔌 Sending WebSocket message:', {
        channelId,
        channelType,
        wkimChannelType,
        payloadType: typeof payload,
        payload: payload
      });

      // Send message
      const ack = await this.im!.send(channelId, wkimChannelType, payload);
      console.log('🔌 WebSocket message sent successfully:', ack);
      return ack;
    } catch (error) {
      console.error('🔌 WebSocket send failed:', error);

      // Update connection status if this was a connection error
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('connect') || errorMsg.includes('websocket') || errorMsg.includes('closed')) {
          console.log('🔌 Send error indicates connection issue, updating status');
          this.updateConnectionStatus({ isConnected: false, isConnecting: false });
        }
      }

      this.notifyErrorHandlers(error);
      throw error;
    }
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Get comprehensive service state for debugging
   */
  getServiceState(): any {
    return {
      hasIM: !!this.im,
      isConnected: this.connectionStatus.isConnected,
      isConnecting: this.connectionStatus.isConnecting,
      isInitialized: this.isInitialized,
      manualDisconnect: this.manualDisconnect,
      hasReconnectTimer: !!this.reconnectTimer,
      hasConnectionPromise: !!this.connectionPromise,
      error: this.connectionStatus.error
    };
  }

  /**
   * Force a clean reconnection - useful when state inconsistency is detected
   */
  async forceReconnect(config: WuKongIMWebSocketConfig): Promise<void> {
    console.log('🔌 Force reconnect requested:', this.getServiceState());

    // Clean up current connection completely
    this.cleanupConnection();

    // Wait a bit to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Initialize fresh connection
    return this.init(config);
  }

  /**
   * Add message handler
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Add connection status handler
   */
  onConnectionStatus(handler: ConnectionStatusHandler): () => void {
    this.connectionStatusHandlers.push(handler);
    return () => {
      const index = this.connectionStatusHandlers.indexOf(handler);
      if (index > -1) {
        this.connectionStatusHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Add error handler
   */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.push(handler);
    return () => {
      const index = this.errorHandlers.indexOf(handler);
      if (index > -1) {
        this.errorHandlers.splice(index, 1);
      }
    };
  }

  // Track event handlers for proper cleanup
  private eventHandlers: {
    connect?: (result: any) => void;
    disconnect?: (reason: any) => void;
    message?: (message: any) => void;
    error?: (error: any) => void;
    customEvent?: (event: any) => void;
  } = {};

  /**
   * Clear WebSocket event listeners to prevent duplicate handlers
   */
  private clearEventListeners(): void {
    if (!this.im) return;

    try {
      // Remove specific event listeners using stored references
      if (this.eventHandlers.connect) {
        this.im.off(WKIMEvent.Connect, this.eventHandlers.connect);
      }
      if (this.eventHandlers.disconnect) {
        this.im.off(WKIMEvent.Disconnect, this.eventHandlers.disconnect);
      }
      if (this.eventHandlers.message) {
        this.im.off(WKIMEvent.Message, this.eventHandlers.message);
      }
      if (this.eventHandlers.error) {
        this.im.off(WKIMEvent.Error, this.eventHandlers.error);
      }
      if (this.eventHandlers.customEvent) {
        this.im.off(WKIMEvent.CustomEvent, this.eventHandlers.customEvent);
      }

      // Clear handler references
      this.eventHandlers = {};
      console.log('🔌 Cleared all WebSocket event listeners (including CustomEvent)');
    } catch (error) {
      // Some versions of the SDK might not support off() method properly
      console.warn('🔌 Could not clear event listeners:', error);
      // Reset handler references anyway
      this.eventHandlers = {};
    }
  }

  /**
   * Setup WebSocket event listeners
   */
  private setupEventListeners(): void {
    if (!this.im) return;

    // CRITICAL: Clear existing listeners first to prevent duplicate message handling
    this.clearEventListeners();

    console.log('🔌 Setting up fresh WebSocket event listeners');

    // Connection established
    this.eventHandlers.connect = (result: any) => {
      console.log('🔌 WuKongIM WebSocket connected:', result);
      this.updateConnectionStatus({ isConnected: true, isConnecting: false, error: undefined });
      console.log('🔌 Service state:', this.getServiceState());
    };
    this.im.on(WKIMEvent.Connect, this.eventHandlers.connect);

    // Connection lost
    this.eventHandlers.disconnect = (reason: any) => {
      console.log('🔌 WuKongIM WebSocket disconnected:', reason, {
        manualDisconnect: this.manualDisconnect,
        hasIM: !!this.im,
        wasConnected: this.connectionStatus.isConnected
      });

      // CRITICAL: Clear the IM instance when disconnected to maintain state consistency
      // This prevents the state where isConnected=true but this.im is in broken state
      if (!this.manualDisconnect) {
        console.log('🔌 Clearing IM instance due to disconnect');
        this.im = undefined;
        this.isInitialized = false;
      }

      // Only update status if not manually disconnected
      if (!this.manualDisconnect) {
        this.updateConnectionStatus({ isConnected: false, isConnecting: false });

        // Only attempt to reconnect for certain disconnect reasons
        // Avoid reconnecting on normal closures (code 1000) or client-initiated closures
        if (this.shouldAttemptReconnect(reason)) {
          console.log('🔌 Will attempt to reconnect in 1s (Attempt 1)');
          this.scheduleReconnect();
        }
      } else {
        console.log('🔌 Manual disconnect, not attempting reconnection');
        this.updateConnectionStatus({ isConnected: false, isConnecting: false });
      }
    };
    this.im.on(WKIMEvent.Disconnect, this.eventHandlers.disconnect);

    // Message received - Single handler only
    this.eventHandlers.message = (message: any) => {
      console.log('🔌 WuKongIM message received (single handler):', {
        messageId: message?.messageId || message?.id,
        content: typeof message?.content === 'string' ? message.content.substring(0, 50) + '...' : message?.content,
        channelId: message?.channelId
      });
      try {
        // Convert WuKongIM message to internal format
        const convertedMessage = this.convertWuKongIMMessage(message);
        this.notifyMessageHandlers(convertedMessage);
      } catch (error) {
        console.error('Failed to convert received message:', error);
        this.notifyErrorHandlers(error);
      }
    };
    this.im.on(WKIMEvent.Message, this.eventHandlers.message);

    // Error occurred
    this.eventHandlers.error = (error: any) => {
      console.error('🔌 WuKongIM WebSocket error:', error);

      // Don't immediately update status on error if we're manually disconnecting
      if (!this.manualDisconnect) {
        this.updateConnectionStatus({
          isConnected: false,
          isConnecting: false,
          error: error.message || 'WebSocket error',
        });
      }

      this.notifyErrorHandlers(error);
    };
    this.im.on(WKIMEvent.Error, this.eventHandlers.error);

    // Custom event - AI stream message handling and visitor presence
    this.eventHandlers.customEvent = (event: any) => {
      console.log('🔌 WuKongIM CustomEvent received:', {
        id: event?.id,
        type: event?.type,
        timestamp: event?.timestamp,
        dataPreview: typeof event?.data === 'string' ? event.data.substring(0, 50) + '...' : event?.data
      });

      try {
        if (event.type === '___TextMessageContent') {
          // AI streaming content
          this.notifyStreamMessageHandlers(event.id, event.data);
        } else if (event.type === 'visitor.online' || event.type === 'visitor.offline') {
          // Visitor presence updates
          let payload: any = null;
          try {
            payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          } catch (e) {
            console.warn('🔌 Failed to parse presence event data:', e);
          }
          const visitorId: string | undefined = payload?.visitor_id || payload?.visitorId || payload?.id;
          const channelId: string | undefined = payload?.channel_id || payload?.channelId || visitorId;
          const channelType: number = typeof payload?.channel_type === 'number' ? payload.channel_type : CHANNEL_TYPE.PERSON;
          const isOnline: boolean = event.type === 'visitor.online' ? true : event.type === 'visitor.offline' ? false : Boolean(payload?.is_online);
          const ts: string | undefined = typeof payload?.timestamp === 'string' ? payload.timestamp : undefined;

          if (!channelId) {
            console.warn('🔌 Presence event missing channel_id (and visitor_id), ignoring');
          } else {
            this.notifyVisitorPresenceHandlers({ visitorId, channelId, channelType, isOnline, timestamp: ts, eventType: event.type, raw: payload });
          }
        } else if (event.type === 'visitor.profile.updated') {
          // Visitor profile updated -> refresh specific channel info
          let payload: any = null;
          try {
            payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          } catch (e) {
            console.warn('🔌 Failed to parse visitor.profile.updated data:', e);
          }
          const visitorId: string | undefined = payload?.visitor_id || payload?.visitorId || payload?.id;
          const channelId: string | undefined = payload?.channel_id || payload?.channelId;
          const channelType: number | undefined = typeof payload?.channel_type === 'number' ? payload.channel_type : undefined;

          if (!channelId || typeof channelType !== 'number' || !Number.isFinite(channelType)) {
            console.warn('🔌 visitor.profile.updated missing channel_id or channel_type, ignoring');
          } else {
            this.notifyVisitorProfileUpdatedHandlers({ visitorId, channelId, channelType, raw: payload });
          }
        } else if (event.type === '___TextMessageEnd') {
          // AI streaming content ended
          console.log('🔌 Stream message ended:', { clientMsgNo: event.id });
          this.notifyStreamEndHandlers(event.id);
        } else {
          console.log('🔌 CustomEvent type not handled:', event.type);
        }
      } catch (error) {
        console.error('🔌 Failed to handle CustomEvent:', error);
        this.notifyErrorHandlers(error);
      }
    };
    this.im.on(WKIMEvent.CustomEvent, this.eventHandlers.customEvent);

    console.log('🔌 WebSocket event listeners setup completed (including CustomEvent)');
  }

  /**
   * Convert channel type to WuKongIM format
   */
  private convertChannelType(channelType: number): any {
    // Map internal channel types to WuKongIM channel types
    switch (channelType) {
      case CHANNEL_TYPE.PERSON: // Person
        return WKIMChannelType.Person;
      case CHANNEL_TYPE.GROUP: // Group
        return WKIMChannelType.Group;
      default:
        return channelType;
    }
  }

  /**
   * Convert WuKongIM message to internal Message format
   */
  private convertWuKongIMMessage(wkimMessage: WuKongIMMessage): Message {
    return WuKongIMUtils.convertToMessage(wkimMessage);
  }

  /**
   * Determine if we should attempt to reconnect based on disconnect reason
   */
  private shouldAttemptReconnect(reason: any): boolean {
    // Don't reconnect if manually disconnected
    if (this.manualDisconnect) {
      return false;
    }

    // Get the close code from the reason
    const code = reason?.code || reason;

    // Don't reconnect for normal closures (1000) or client-initiated closures (1001)
    if (code === 1000 || code === 1001) {
      console.log('🔌 Normal closure, not reconnecting', { code });
      return false;
    }

    // Don't reconnect for authentication errors (typically 1002-1015)
    if (code >= 1002 && code <= 1015) {
      console.log('🔌 Authentication/protocol error, not reconnecting', { code });
      return false;
    }

    // Reconnect for abnormal closures (1006) and other unexpected disconnections
    console.log('🔌 Unexpected disconnection, will reconnect', { code, reason });
    return true;
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.manualDisconnect) {
      return;
    }

    // Simple 1-second delay for now (could be enhanced with exponential backoff)
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;

      if (!this.manualDisconnect && !this.connectionStatus.isConnected) {
        console.log('🔌 Attempting automatic reconnection...');
        // Note: We don't have the original config here, so reconnection
        // should be handled by the hook's auto-connect logic
        this.updateConnectionStatus({ isConnecting: false, isConnected: false });
      }
    }, 1000);
  }

  /**
   * Update connection status and notify handlers
   */
  private updateConnectionStatus(status: Partial<ConnectionStatus>): void {
    this.connectionStatus = { ...this.connectionStatus, ...status };
    this.notifyConnectionStatusHandlers(this.connectionStatus);
  }

  /**
   * Notify all message handlers
   */
  private notifyMessageHandlers(message: Message): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Message handler error:', error);
      }
    });
  }

  /**
   * Notify all connection status handlers
   */
  private notifyConnectionStatusHandlers(status: ConnectionStatus): void {
    this.connectionStatusHandlers.forEach(handler => {
      try {
        handler(status);
      } catch (error) {
        console.error('Connection status handler error:', error);
      }
    });
  }

  /**
   * Notify all error handlers
   */
  private notifyErrorHandlers(error: any): void {
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (error) {
        console.error('Error handler error:', error);
      }
    });
  }

  /**
   * Notify all stream message handlers
   */
  private notifyStreamMessageHandlers(clientMsgNo: string, content: string): void {
    console.log('🔌 Notifying stream message handlers:', {
      clientMsgNo,
      handlerCount: this.streamMessageHandlers.length,
      contentLength: content?.length
    });

    this.streamMessageHandlers.forEach(handler => {
      try {
        handler(clientMsgNo, content);
      } catch (error) {
        console.error('Stream message handler error:', error);
      }
    });

    // Broadcast a DOM event so UI components can react (e.g., keep scroll position)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chat:stream-update', {
        detail: {
          clientMsgNo,
          contentLength: content?.length ?? 0
        }
      }));
    }
  }

  /**
   * Notify all stream end handlers
   */
  private notifyStreamEndHandlers(clientMsgNo: string): void {
    console.log('🔌 Notifying stream end handlers:', {
      clientMsgNo,
      handlerCount: this.streamEndHandlers.length
    });

    this.streamEndHandlers.forEach(handler => {
      try {
        handler(clientMsgNo);
      } catch (error) {
        console.error('Stream end handler error:', error);
      }
    });

    // Broadcast a DOM event so UI components can react
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chat:stream-end', {
        detail: { clientMsgNo }
      }));
    }
  }

  /**
   * Notify all visitor profile updated handlers
   */
  private notifyVisitorProfileUpdatedHandlers(event: VisitorProfileUpdatedEvent): void {
    console.log('🔌 Notifying visitor profile updated handlers:', {
      channelId: event.channelId,
      channelType: event.channelType,
      visitorId: event.visitorId,
      handlerCount: this.visitorProfileUpdatedHandlers.length
    });

    this.visitorProfileUpdatedHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Visitor profile updated handler error:', error);
      }
    });
  }

  /**
   * Notify all visitor presence handlers
   */
  private notifyVisitorPresenceHandlers(event: VisitorPresenceEvent): void {
    console.log('\ud83d\udd0c Notifying visitor presence handlers:', {
      channelId: event.channelId,
      channelType: event.channelType,
      visitorId: event.visitorId,
      isOnline: event.isOnline,
      timestamp: event.timestamp,
      type: event.eventType,
      handlerCount: this.visitorPresenceHandlers.length
    });

    this.visitorPresenceHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Visitor presence handler error:', error);
      }
    });
  }

  /**
   * Subscribe to visitor profile updated events
   */
  onVisitorProfileUpdated(handler: VisitorProfileUpdatedHandler): () => void {
    this.visitorProfileUpdatedHandlers.push(handler);
    console.log('🔌 Visitor profile updated handler registered, total:', this.visitorProfileUpdatedHandlers.length);
    return () => {
      const index = this.visitorProfileUpdatedHandlers.indexOf(handler);
      if (index > -1) {
        this.visitorProfileUpdatedHandlers.splice(index, 1);
        console.log('🔌 Visitor profile updated handler unregistered, remaining:', this.visitorProfileUpdatedHandlers.length);
      }
    };
  }


  /**
   * Subscribe to stream messages (AI incremental updates)
   */
  onStreamMessage(handler: StreamMessageHandler): () => void {
    this.streamMessageHandlers.push(handler);
    console.log('🔌 Stream message handler registered, total:', this.streamMessageHandlers.length);

    return () => {
      const index = this.streamMessageHandlers.indexOf(handler);
      if (index > -1) {
        this.streamMessageHandlers.splice(index, 1);
        console.log('🔌 Stream message handler unregistered, remaining:', this.streamMessageHandlers.length);
      }
    };
  }

  /**
   * Subscribe to stream end events (AI streaming finished)
   */
  onStreamEnd(handler: StreamEndHandler): () => void {
    this.streamEndHandlers.push(handler);
    console.log('🔌 Stream end handler registered, total:', this.streamEndHandlers.length);

    return () => {
      const index = this.streamEndHandlers.indexOf(handler);
      if (index > -1) {
        this.streamEndHandlers.splice(index, 1);
        console.log('🔌 Stream end handler unregistered, remaining:', this.streamEndHandlers.length);
      }
    };
  }

  /**
   * Subscribe to visitor presence events (visitor.online / visitor.offline)
   */
  onVisitorPresence(handler: VisitorPresenceHandler): () => void {
    this.visitorPresenceHandlers.push(handler);
    console.log('🔌 Visitor presence handler registered, total:', this.visitorPresenceHandlers.length);
    return () => {
      const index = this.visitorPresenceHandlers.indexOf(handler);
      if (index > -1) {
        this.visitorPresenceHandlers.splice(index, 1);
        console.log('🔌 Visitor presence handler unregistered, remaining:', this.visitorPresenceHandlers.length);
      }
    };
  }
}

// Singleton instance
export const wukongimWebSocketService = new WuKongIMWebSocketService();
