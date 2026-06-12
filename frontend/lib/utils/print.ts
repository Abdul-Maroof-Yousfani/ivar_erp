import { toast } from "sonner";

interface PrintSettings {
    receiptPrinterName?: string;
    [key: string]: any;
}

/**
 * Utility to print a specific DOM element.
 * If running inside the Electron app and a printer is configured, it will print silently.
 * Otherwise, it falls back to standard window.print().
 *
 * @param elementId The ID of the HTML element containing the receipt content
 * @param settings The POS settings object which may contain the printer configuration
 */
export async function printThermal(elementId: string, settings?: PrintSettings): Promise<void> {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`[printThermal] Element with ID "${elementId}" not found.`);
        // Fallback in case of absolute emergency
        window.print();
        return;
    }

    const isElectron = typeof window !== "undefined" && !!window.posDesktop;
    const printerName = settings?.receiptPrinterName;

    if (isElectron && window.posDesktop && printerName) {
        try {
            // Collect all stylesheets and styles on the page to inject into the print window
            const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
                .map(el => el.outerHTML)
                .join('\n');

            const contentHtml = element.innerHTML;

            const fullHtml = `
                <!DOCTYPE html>
                <html>
                    <head>
                        <meta charset="utf-8">
                        <title>Print Receipt</title>
                        ${styles}
                        <style>
                            /* Reset and styling for silent receipt printing */
                            body {
                                background: #fff !important;
                                color: #000 !important;
                                margin: 0 !important;
                                padding: 0 !important;
                                width: 72.1mm !important;
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                            #receipt-print-root,
                            #return-print-root,
                            #voucher-print-root,
                            #voucher-receipt-print-root,
                            #claim-print-root,
                            .receipt-print-container {
                                position: static !important;
                                left: auto !important;
                                top: auto !important;
                                width: 72.1mm !important;
                                display: block !important;
                                visibility: visible !important;
                                background: #fff !important;
                                color: #000 !important;
                                font-family: 'Courier New', Courier, monospace !important;
                                font-size: 9pt !important;
                                line-height: 1.35 !important;
                            }
                            #receipt-print-root *,
                            #return-print-root *,
                            #voucher-print-root *,
                            #voucher-receipt-print-root *,
                            #claim-print-root *,
                            .receipt-print-container * {
                                color: #000 !important;
                                border-color: #000 !important;
                            }
                            /* Per-voucher page wrapper — padding lives here, not on the root */
                            .voucher-print-page {
                                padding: 2mm 1mm !important;
                                page-break-inside: avoid !important;
                                break-inside: avoid !important;
                            }
                            /* The cut class triggers the thermal cutter between vouchers */
                            .voucher-print-page.voucher-cut {
                                page-break-after: always !important;
                                break-after: page !important;
                            }
                            @page { margin: 0; size: 80mm auto; }
                            /* Prevent margin overlap */
                            * {
                                box-sizing: border-box;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="receipt-print-container">
                            ${contentHtml}
                        </div>
                    </body>
                </html>
            `;

            toast.loading("Sending to printer...", { id: "silent-print" });
            const result = await window.posDesktop.printHtml(fullHtml, printerName);
            
            if (result.success) {
                toast.success("Receipt printed successfully", { id: "silent-print" });
            } else {
                console.warn("[printThermal] Silent print failed, falling back:", result.error);
                toast.error(`Silent print failed: ${result.error || "Unknown error"}. Opening standard print dialog.`, { id: "silent-print" });
                window.print();
            }
            return;
        } catch (err: any) {
            console.error("[printThermal] Error during silent printing:", err);
            toast.error("Silent printing error. Opening standard print dialog.", { id: "silent-print" });
            window.print();
            return;
        }
    }

    // Fallback to standard window.print() for web browser or when no printer is configured
    window.print();
}
