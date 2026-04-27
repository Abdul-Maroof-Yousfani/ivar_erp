import { useState, useEffect, useRef, useCallback } from 'react';
import { getApiBaseUrl } from '@/lib/utils';

export interface UploadStats {
    totalRecords: number;
    processedRecords: number;
    successRecords: number;
    failedRecords: number;
    skippedRecords: number;
    progress: number;
}

export interface UploadError {
    row: number;
    reason: string;
    data: any;
}

export interface UploadStatusResponse {
    uploadId: string;
    filename: string;
    status: 'pending' | 'validating' | 'validated' | 'processing' | 'completed' | 'failed' | 'cancelled';
    totalRecords: number;
    processedRecords: number;
    successRecords: number;
    failedRecords: number;
    skippedRecords: number;
    progress: number;
    jobState: string;
    errors: UploadError[];
    message?: string;
    recsPerSec?: number;
    memoryUsageMB?: number;
    createdAt: string;
    completedAt: string | null;
}

export function useUploadProgress(uploadId: string | null, uploadType: 'item' | 'hscode' | 'employee' | 'attendance' = 'item') {
    const [data, setData] = useState<UploadStatusResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [speed, setSpeed] = useState(0);
    const prevProcessedRef = useRef(0);
    const prevTimestampRef = useRef(Date.now());
    const eventSourceRef = useRef<EventSource | null>(null);
    const isTerminalRef = useRef(false); // stops reconnects once job is done

    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const MAX_RECONNECT_ATTEMPTS = 8;

    const stopStreaming = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
    }, []);

    const getApiEndpoint = useCallback((endpoint: string) => {
        const baseUrl = getApiBaseUrl();
        if (uploadType === 'hscode') {
            return `${baseUrl}/master/hs-codes/bulk-upload/${endpoint}`;
        }
        if (uploadType === 'employee') {
            return `${baseUrl}/employees/bulk-upload/${endpoint}`;
        }
        if (uploadType === 'attendance') {
            return `${baseUrl}/attendances/bulk-upload/${endpoint}`;
        }
        return `${baseUrl}/items/bulk-upload/${endpoint}`;
    }, [uploadType]);

    const fetchInitialStatus = useCallback(async () => {
        if (!uploadId) return;
        try {
            const response = await fetch(getApiEndpoint(`${uploadId}/status`), {
                credentials: "include",
                // No timeout — large files can take time to respond during heavy DB load
            });
            const result = await response.json();
            if (result.status && result.data) {
                setData(result.data);
                setError(null);
                // If already terminal when we first load, don't open SSE
                if (['completed', 'failed', 'cancelled'].includes(result.data.status)) {
                    isTerminalRef.current = true;
                }
            } else {
                setError(result.message || 'Failed to fetch status');
            }
        } catch (err) {
            // Non-fatal — SSE will still deliver updates even if initial status fetch fails
            console.warn('Initial status fetch failed (non-fatal):', err);
        }
    }, [uploadId, getApiEndpoint]);

    useEffect(() => {
        if (!uploadId) {
            setData(null);
            setSpeed(0);
            isTerminalRef.current = false;
            reconnectAttemptsRef.current = 0;
            stopStreaming();
            return;
        }

        isTerminalRef.current = false;
        reconnectAttemptsRef.current = 0;

        // Fetch initial status once — gives us data before first SSE event arrives
        fetchInitialStatus();

        const connectSSE = () => {
            if (isTerminalRef.current) return;

            // Use the Next.js SSE proxy — EventSource can't send headers and
            // SameSite:Lax blocks cross-origin cookies, so we proxy through Next.js
            // which reads the httpOnly accessToken server-side and forwards the stream.
            const sseUrl = `/api/bulk-upload/${uploadId}/events?type=${uploadType}`;
            const eventSource = new EventSource(sseUrl);
            eventSourceRef.current = eventSource;

            eventSource.onmessage = (event) => {
                try {
                    const eventData = JSON.parse(event.data);
                    const { type, data: payload } = eventData;

                    // Ignore keepalive heartbeats — they exist only to prevent proxy timeouts
                    if (type === 'heartbeat') return;

                    // Reset reconnect counter on successful message
                    reconnectAttemptsRef.current = 0;

                    setData((prev) => {
                        const base = prev || {
                            uploadId: uploadId || '',
                            filename: '',
                            status: 'pending',
                            totalRecords: 0,
                            processedRecords: 0,
                            successRecords: 0,
                            failedRecords: 0,
                            skippedRecords: 0,
                            progress: 0,
                            jobState: 'active',
                            errors: [],
                            createdAt: new Date().toISOString(),
                            completedAt: null
                        } as UploadStatusResponse;

                        const updated = { ...base };

                        if (type === 'status') {
                            if (!['completed', 'failed', 'validated'].includes(updated.status)) {
                                updated.status = payload.status || updated.status;
                            }
                            updated.message = payload.message || updated.message;
                            if (payload.progress !== undefined) updated.progress = payload.progress;
                        } else if (type === 'progress') {
                            updated.progress = payload.progress ?? updated.progress;
                            updated.processedRecords = payload.processedRecords ?? updated.processedRecords;
                            updated.successRecords = payload.successRecords ?? updated.successRecords;
                            updated.failedRecords = payload.failedRecords ?? updated.failedRecords;
                            updated.recsPerSec = payload.recsPerSec ?? updated.recsPerSec;
                            updated.memoryUsageMB = payload.memoryUsageMB ?? updated.memoryUsageMB;
                            if (!['completed', 'failed'].includes(updated.status) && payload.status) {
                                updated.status = payload.status;
                            }
                        } else if (type === 'completed') {
                            updated.status = payload.status || 'completed';
                            updated.successRecords = payload.successRecords ?? updated.successRecords;
                            updated.failedRecords = payload.failedRecords ?? updated.failedRecords;
                            updated.totalRecords = payload.totalRecords ?? updated.totalRecords;
                            updated.errors = payload.errors || updated.errors;
                            updated.progress = 100;
                        } else if (type === 'failed') {
                            updated.status = 'failed';
                            updated.message = payload.message;
                        }

                        return updated;
                    });

                    // Close SSE once terminal — no point keeping the connection open
                    const isTerminal = (['completed', 'failed', 'cancelled'].includes(type) || 
                                      ['completed', 'failed', 'cancelled'].includes(payload?.status)) &&
                                      payload?.status !== 'validated';

                    if (isTerminal) {
                        isTerminalRef.current = true;
                        stopStreaming();
                        // Fetch final status from DB to get complete error list
                        fetchInitialStatus();
                    }
                } catch (err) {
                    console.error('Failed to parse SSE event:', err);
                }
            };

            eventSource.onerror = () => {
                eventSource.close();
                eventSourceRef.current = null;

                if (isTerminalRef.current) return;

                // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s cap
                const attempt = reconnectAttemptsRef.current;
                if (attempt >= MAX_RECONNECT_ATTEMPTS) {
                    console.warn(`SSE: max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached, falling back to status polling`);
                    // Fall back to polling the status endpoint every 3s
                    const pollInterval = setInterval(async () => {
                        await fetchInitialStatus();
                        if (isTerminalRef.current) clearInterval(pollInterval);
                    }, 3000);
                    reconnectTimerRef.current = null;
                    return;
                }

                const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
                reconnectAttemptsRef.current += 1;
                console.warn(`SSE dropped, reconnecting in ${delay}ms (attempt ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS})...`);
                reconnectTimerRef.current = setTimeout(connectSSE, delay);
            };
        };

        connectSSE();

        return () => {
            stopStreaming();
        };
    }, [uploadId, getApiEndpoint, stopStreaming]); // fetchInitialStatus removed from deps — called once on mount only

    // Speed calculation using refs to avoid stale closure issues
    useEffect(() => {
        if (!data?.processedRecords) return;

        const now = Date.now();
        const timeDiff = (now - prevTimestampRef.current) / 1000;
        const processedDiff = data.processedRecords - prevProcessedRef.current;

        if (timeDiff >= 1 && processedDiff > 0) {
            setSpeed(Math.round(processedDiff / timeDiff));
            prevProcessedRef.current = data.processedRecords;
            prevTimestampRef.current = now;
        }
    }, [data?.processedRecords]);

    return {
        data,
        loading,
        error,
        speed,
        isComplete: data?.status === 'completed' || data?.status === 'validated',
        isValidated: data?.status === 'validated',
        isValidating: data?.status === 'validating',
        isFailed: data?.status === 'failed',
        isProcessing: data?.status === 'processing' || data?.status === 'validating',
        isCancelled: data?.status === 'cancelled',
        refetch: fetchInitialStatus,
    };
}
