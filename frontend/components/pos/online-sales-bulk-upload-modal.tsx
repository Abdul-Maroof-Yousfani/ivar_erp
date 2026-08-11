'use client';

import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { GenericBulkUploadModal } from '../master/generic-bulk-upload-modal';

interface OnlineSalesBulkUploadModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    uploadId?: string | null;
    onUploadIdChange?: (id: string | null) => void;
}

export function OnlineSalesBulkUploadModal(props: OnlineSalesBulkUploadModalProps) {
    return (
        <GenericBulkUploadModal
            {...props}
            uploadType="online-sales"
            apiBasePath="pos-sales/online-sales/bulk-upload"
            title="Online Outlet Daily Sales Import"
            description="Upload daily sales from online outlets (Shopify JSON / CSV / Excel). Auto-creates missing customers, converts online discounts to WOST (Without Sales Tax), and generates internal SI-ONL sequence numbers."
            icon={ShoppingCart}
        />
    );
}
