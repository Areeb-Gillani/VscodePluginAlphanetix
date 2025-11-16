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
}
