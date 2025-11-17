import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import * as vscode from 'vscode';
import { StateManager } from '../state/StateManager';

/**
 * Base API client for AlphanetixAI platform
 */
export class ApiClient {
    private static instance: ApiClient;
    private axiosInstance: AxiosInstance;
    private baseUrl: string;

    private constructor() {
        this.baseUrl = this.getBaseUrl();
        this.axiosInstance = axios.create({
            baseURL: this.baseUrl,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Request interceptor to add auth token
        this.axiosInstance.interceptors.request.use(
            async (config) => {
                const token = await StateManager.getInstance().getAuthToken();
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor for error handling
        this.axiosInstance.interceptors.response.use(
            (response) => response,
            async (error: AxiosError) => {
                if (error.response?.status === 401) {
                    // Token expired, try to refresh
                    const refreshed = await this.refreshToken();
                    if (refreshed && error.config) {
                        // Retry the original request
                        return this.axiosInstance.request(error.config);
                    } else {
                        // Refresh failed, logout user
                        vscode.window.showErrorMessage('Session expired. Please sign in again.');
                        vscode.commands.executeCommand('alphanetix.logout');
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    public static getInstance(): ApiClient {
        if (!ApiClient.instance) {
            ApiClient.instance = new ApiClient();
        }
        return ApiClient.instance;
    }

    private getBaseUrl(): string {
        const config = vscode.workspace.getConfiguration('alphanetix');
        return config.get<string>('apiUrl') || 'http://localhost:9100';
    }

    public updateBaseUrl(): void {
        this.baseUrl = this.getBaseUrl();
        this.axiosInstance.defaults.baseURL = this.baseUrl;
    }

    private async refreshToken(): Promise<boolean> {
        try {
            const refreshToken = await StateManager.getInstance().getRefreshToken();
            if (!refreshToken) {
                return false;
            }

            const response = await axios.post(`${this.baseUrl}/api/auth/refresh-token`, {
                refreshToken,
            });

            if (response.data.token) {
                await StateManager.getInstance().setAuthToken(response.data.token);
                if (response.data.refreshToken) {
                    await StateManager.getInstance().setRefreshToken(response.data.refreshToken);
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('Token refresh failed:', error);
            return false;
        }
    }

    public getAxios(): AxiosInstance {
        return this.axiosInstance;
    }

    public getApiUrl(apiPath: string): string {
        return `${this.baseUrl}${apiPath}`;
    }



    public async get<T>(url: string, params?: any): Promise<T> {
        const response = await this.axiosInstance.get<T>(this.getApiUrl(url), { params });
        return response.data;
    }

    public async post<T>(url: string, data?: any, params?: any): Promise<T> {
        // Set longer timeout for AI completion endpoint (5 minutes)
        const config: AxiosRequestConfig = { params };
        if (url === '/api/chat/completion') {
            config.timeout = 300000; // 5 minutes for AI responses
        }
        
        const response = await this.axiosInstance.post<T>(this.getApiUrl(url), data, config);
        return response.data;
    }

    public async put<T>(url: string, data?: any, params?: any): Promise<T> {
        const response = await this.axiosInstance.put<T>(this.getApiUrl(url), data, { params });
        return response.data;
    }

    public async delete<T>(url: string, params?: any): Promise<T> {
        const response = await this.axiosInstance.delete<T>(this.getApiUrl(url), { params });
        return response.data;
    }

    /**
     * Stream data from a Server-Sent Events (SSE) endpoint
     * @param url API endpoint URL
     * @param data Request body data
     * @param onMessage Callback for each SSE message
     * @param onError Callback for errors
     * @param onComplete Callback when stream completes
     */
    public async streamPost(
        url: string,
        data: any,
        onMessage: (event: string, data: string) => void,
        onError?: (error: Error) => void,
        onComplete?: () => void
    ): Promise<void> {
        const token = await StateManager.getInstance().getAuthToken();
        const fullUrl = this.getApiUrl(url);

        // Using fetch with ReadableStream for SSE
        try {
            const response = await fetch(fullUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'text/event-stream',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            if (!response.body) {
                throw new Error('Response body is null');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            
            // Persist state across chunks
            let currentEvent = 'message';
            let dataLines: string[] = [];

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    // Flush any remaining data before completing
                    if (dataLines.length > 0) {
                        const fullData = dataLines.join('\n');
                        onMessage(currentEvent, fullData);
                    }
                    if (onComplete) {
                        onComplete();
                    }
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith('event:')) {
                        currentEvent = line.substring(6).trim();
                    } else if (line.startsWith('data:')) {
                        // SSE format is "data:<content>" or "data: <content>"
                        // Preserve all formatting in content (spaces, newlines, tabs)
                        let lineData: string;
                        if (line.startsWith('data: ')) {
                            // Has space after colon - skip "data: " (6 chars)
                            lineData = line.substring(6);
                        } else {
                            // No space after colon - skip "data:" (5 chars)
                            lineData = line.substring(5);
                        }
                        console.log(`📥 SSE Line: "${line.substring(0, 100).replace(/\n/g, '\\n').replace(/\t/g, '\\t')}"`);
                        console.log(`📥 Extracted data: "${lineData.substring(0, 100).replace(/\n/g, '\\n').replace(/\t/g, '\\t')}" (length: ${lineData.length})`);
                        
                        // Accumulate data lines (SSE spec: multiple data lines = multi-line content)
                        dataLines.push(lineData);
                    } else if (line.trim() === '') {
                        // Empty line indicates end of message - dispatch accumulated data
                        if (dataLines.length > 0) {
                            // Join multiple data lines with newlines (SSE spec)
                            const fullData = dataLines.join('\n');
                            onMessage(currentEvent, fullData);
                            currentEvent = 'message'; // Reset for next message
                            dataLines = [];
                        }
                    }
                }
            }
        } catch (error) {
            console.error('SSE stream error:', error);
            if (onError) {
                onError(error instanceof Error ? error : new Error(String(error)));
            }
        }
    }
}
