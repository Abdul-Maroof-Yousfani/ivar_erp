"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./auth-provider";

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, user } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!isAuthenticated) {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
                setIsConnected(false);
            }
            return;
        }

        const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";
        const baseUrl = API_URL.replace(/\/api$/, "");

        const socket = io(baseUrl, {
            transports: ["websocket"],
            auth: {
                token: document.cookie
                    .split("; ")
                    .find((row) => row.startsWith("access_token="))
                    ?.split("=")[1],
            },
        });

        socketRef.current = socket;

        socket.on("connect", () => {
            console.log("Connected to global WebSocket");
            setIsConnected(true);
        });

        socket.on("disconnect", () => {
            console.log("Disconnected from global WebSocket");
            setIsConnected(false);
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
            setIsConnected(false);
        };
    }, [isAuthenticated]);

    return (
        <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
}

export const useSocket = () => useContext(SocketContext);
