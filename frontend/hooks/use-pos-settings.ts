"use client";

import { useState, useEffect } from "react";
import { authFetch } from "@/lib/auth";

export interface PosSettings {
    receiptStoreName: string;
    receiptFooter: string;
    receiptShowTax: boolean;
    receiptAutoPrint: boolean;
    receiptShowCashier: boolean;
    defaultPaymentMethod: string;
    requireCustomer: boolean;
    defaultTaxPercent: string;
    theme: string;
}

export const POS_SETTINGS_DEFAULTS: PosSettings = {
    receiptStoreName: "",
    receiptFooter: "Thank you for your purchase!",
    receiptShowTax: true,
    receiptAutoPrint: false,
    receiptShowCashier: true,
    defaultPaymentMethod: "cash",
    requireCustomer: false,
    defaultTaxPercent: "0",
    theme: "system",
};

const PREF_KEY = "pos.terminal.settings";

export function usePosSettings() {
    const [settings, setSettings] = useState<PosSettings>(POS_SETTINGS_DEFAULTS);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        authFetch(`/user-preferences/${PREF_KEY}`)
            .then((res) => {
                if (res.ok && res.data?.value) {
                    setSettings({ ...POS_SETTINGS_DEFAULTS, ...res.data.value });
                }
            })
            .catch(() => { /* use defaults */ })
            .finally(() => setIsLoading(false));
    }, []);

    return { settings, isLoading };
}
