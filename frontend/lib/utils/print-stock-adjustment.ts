import { format } from "date-fns";

export interface PrintStockAdjustmentItem {
  id?: string;
  adjustedQty?: number | string;
  physicalQty?: number | string;
  currentQty?: number | string;
  rate?: number | string;
  locationId?: string | null;
  location?: { id: string; name: string; code: string } | null;
  item?: {
    sku?: string;
    description?: string | null;
    name?: string | null;
    color?: { name: string } | null;
    size?: { name: string } | null;
    brand?: { name: string } | null;
    division?: { name: string } | null;
    gender?: { name: string } | null;
    category?: { name: string } | null;
  } | null;
  swapItem?: {
    sku?: string;
    description?: string | null;
    color?: { name: string } | null;
    size?: { name: string } | null;
  } | null;
}

export interface PrintStockAdjustmentData {
  id: string;
  adjustmentNo: string;
  createdAt: string;
  adjustmentDate?: string;
  status: string;
  reason?: string | null;
  notes?: string | null;
  createdById?: string | null;
  createdBy?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
  } | null;
  requesterName?: string | null;
  warehouse?: { name: string; code: string } | null;
  items: PrintStockAdjustmentItem[];
}

export function printStockAdjustmentNote(
  adj: PrintStockAdjustmentData,
  locationNameOverride?: string,
) {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow popups to print stock adjustment notes.");
    return;
  }

  const dateStr = format(new Date(adj.createdAt || Date.now()), "dd-MMM-yyyy");
  const refNo = adj.adjustmentNo || "N/A";
  const statusLabel =
    adj.status === "SUBMITTED"
      ? "Approved / Closed"
      : adj.status === "PENDING_APPROVAL"
        ? "Pending Approval"
        : adj.status;

  const locationName =
    locationNameOverride ||
    adj.items?.find((i) => i.location?.name)?.location?.name ||
    adj.warehouse?.name ||
    "Head Office / Warehouse";

  // Resolve Requester Name & ID
  let requesterName = adj.requesterName || "";
  if (!requesterName && adj.createdBy) {
    if (adj.createdBy.firstName || adj.createdBy.lastName) {
      requesterName = `${adj.createdBy.firstName || ""} ${adj.createdBy.lastName || ""}`.trim();
    } else if (adj.createdBy.name) {
      requesterName = adj.createdBy.name;
    } else if (adj.createdBy.email) {
      requesterName = adj.createdBy.email;
    }
  }
  if (!requesterName) {
    requesterName = "System User";
  }

  const requesterId = adj.createdById || adj.createdBy?.id || "";

  // Group items hierarchically: Brand > Division > Gender > Category > Items
  const groups: Record<
    string,
    {
      name: string;
      qty: number;
      val: number;
      divisions: Record<
        string,
        {
          name: string;
          qty: number;
          val: number;
          genders: Record<
            string,
            {
              name: string;
              qty: number;
              val: number;
              categories: Record<
                string,
                {
                  name: string;
                  qty: number;
                  val: number;
                  skus: Array<{
                    sku: string;
                    description: string;
                    color: string;
                    size: string;
                    qty: number;
                    rate: number;
                    val: number;
                    swapSku?: string;
                  }>;
                }
              >;
            }
          >;
        }
      >;
    }
  > = {};

  let overallQty = 0;
  let overallVal = 0;
  let primaryBrandName = "Speed (pvt.) Limited";

  adj.items?.forEach((item) => {
    const brandName = item.item?.brand?.name || "General Brand";
    const divName = item.item?.division?.name || "General Division";
    const genderName = item.item?.gender?.name || "Unisex / General";
    const catName = item.item?.category?.name || "General Category";

    if (item.item?.brand?.name) {
      primaryBrandName = item.item.brand.name.toUpperCase();
    } else if (item.item?.division?.name) {
      primaryBrandName = item.item.division.name.toUpperCase();
    }

    if (!groups[brandName]) {
      groups[brandName] = { name: brandName, qty: 0, val: 0, divisions: {} };
    }
    if (!groups[brandName].divisions[divName]) {
      groups[brandName].divisions[divName] = { name: divName, qty: 0, val: 0, genders: {} };
    }
    if (!groups[brandName].divisions[divName].genders[genderName]) {
      groups[brandName].divisions[divName].genders[genderName] = { name: genderName, qty: 0, val: 0, categories: {} };
    }
    if (!groups[brandName].divisions[divName].genders[genderName].categories[catName]) {
      groups[brandName].divisions[divName].genders[genderName].categories[catName] = {
        name: catName,
        qty: 0,
        val: 0,
        skus: [],
      };
    }

    let qty = 0;
    if (item.adjustedQty !== undefined && item.adjustedQty !== null) {
      qty = Number(item.adjustedQty);
    } else if (
      item.physicalQty !== undefined &&
      item.currentQty !== undefined
    ) {
      qty = Number(item.physicalQty) - Number(item.currentQty);
    } else {
      qty = Number(item.physicalQty || 0);
    }

    const rate = Number(item.rate || 0);
    const val = qty * rate;

    overallQty += qty;
    overallVal += val;

    groups[brandName].qty += qty;
    groups[brandName].val += val;
    groups[brandName].divisions[divName].qty += qty;
    groups[brandName].divisions[divName].val += val;
    groups[brandName].divisions[divName].genders[genderName].qty += qty;
    groups[brandName].divisions[divName].genders[genderName].val += val;
    groups[brandName].divisions[divName].genders[genderName].categories[catName].qty += qty;
    groups[brandName].divisions[divName].genders[genderName].categories[catName].val += val;

    const barCode = item.item?.barCode || (item.item as any)?.barcode || (item.item as any)?.upc || "";

    groups[brandName].divisions[divName].genders[genderName].categories[catName].skus.push({
      sku: item.item?.sku || "N/A",
      barCode,
      description: item.item?.description || item.item?.name || "Item Details",
      color: item.item?.color?.name || "N/A",
      size: item.item?.size?.name || "N/A",
      qty,
      rate,
      val,
      swapSku: item.swapItem?.sku,
    });
  });

  // Build Table HTML with clean grid lines and Brand > Division > Gender > Category tree
  let tableRowsHtml = "";
  Object.values(groups).forEach((brand) => {
    tableRowsHtml += `
      <tr class="brand-row">
        <td colspan="3" class="text-left font-bold">BRAND: ${brand.name.toUpperCase()}</td>
        <td class="text-right font-bold">${brand.qty}</td>
        <td></td>
        <td class="text-right font-bold">${brand.val.toLocaleString("en-PK")}</td>
      </tr>
    `;

    Object.values(brand.divisions).forEach((div) => {
      tableRowsHtml += `
        <tr class="division-row">
          <td colspan="3" class="text-left indent-1">DIVISION: ${div.name}</td>
          <td class="text-right font-bold">${div.qty}</td>
          <td></td>
          <td class="text-right font-bold">${div.val.toLocaleString("en-PK")}</td>
        </tr>
      `;

      Object.values(div.genders).forEach((gender) => {
        tableRowsHtml += `
          <tr class="gender-row">
            <td colspan="3" class="text-left indent-2">GENDER: ${gender.name}</td>
            <td class="text-right font-bold">${gender.qty}</td>
            <td></td>
            <td class="text-right font-bold">${gender.val.toLocaleString("en-PK")}</td>
          </tr>
        `;

        Object.values(gender.categories).forEach((cat) => {
          tableRowsHtml += `
            <tr class="category-row">
              <td colspan="3" class="text-left indent-3">CATEGORY: ${cat.name}</td>
              <td class="text-right font-bold">${cat.qty}</td>
              <td></td>
              <td class="text-right font-bold">${cat.val.toLocaleString("en-PK")}</td>
            </tr>
          `;

          cat.skus.forEach((sku) => {
            tableRowsHtml += `
              <tr class="item-row">
                <td class="text-left indent-4">
                  <div class="sku-code">${sku.sku}</div>
                  ${sku.barCode ? `<div class="barcode-sub"><span class="sub-label">Barcode:</span> ${sku.barCode}</div>` : ""}
                  <div class="article-name">${sku.description}</div>
                  <div class="meta-sub"><span class="sub-label">Color:</span> ${sku.color} &nbsp;|&nbsp; <span class="sub-label">Size:</span> ${sku.size}</div>
                  ${sku.swapSku ? `<div class="swap-tag">(Swapped with: ${sku.swapSku})</div>` : ""}
                </td>
                <td class="text-center">${sku.color}</td>
                <td class="text-center font-bold">${sku.size}</td>
                <td class="text-right font-mono font-medium">${sku.qty}</td>
                <td class="text-right font-mono">${sku.rate.toLocaleString("en-PK")}</td>
                <td class="text-right font-mono font-bold">${sku.val.toLocaleString("en-PK")}</td>
              </tr>
            `;
          });
        });
      });
    });
  });

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Stock Adjustment Note - ${refNo}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; padding: 25px 30px; font-size: 10.5px; line-height: 1.3; }

        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .company-title { font-size: 16px; font-weight: 800; letter-spacing: -0.02em; color: #0f172a; text-transform: uppercase; }
        .document-title { font-size: 13px; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-top: 3px; display: inline-block; border-bottom: 2px solid #2563eb; padding-bottom: 1px; }
        .brand-header { font-size: 18px; font-weight: 800; text-align: right; color: #334155; text-transform: uppercase; }

        .meta-card { width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; background-color: #f8fafc; padding: 10px 14px; margin-bottom: 14px; }
        .meta-grid { width: 100%; border-collapse: collapse; }
        .meta-grid td { padding: 3px 6px; vertical-align: top; font-size: 10.5px; }
        .meta-label { font-weight: 700; color: #475569; width: 120px; text-transform: uppercase; font-size: 9.5px; }
        .meta-val { font-weight: 600; color: #0f172a; }

        .status-badge {
          display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; border: 1.5px solid;
          color: ${adj.status === "SUBMITTED" ? "#15803d" : adj.status === "REJECTED" || adj.status === "CANCELLED" ? "#b91c1c" : "#1d4ed8"};
          border-color: ${adj.status === "SUBMITTED" ? "#86efac" : adj.status === "REJECTED" || adj.status === "CANCELLED" ? "#fca5a5" : "#93c5fd"};
          background-color: ${adj.status === "SUBMITTED" ? "#f0fdf4" : adj.status === "REJECTED" || adj.status === "CANCELLED" ? "#fef2f2" : "#eff6ff"};
        }

        /* Compact Table with Grid Lines */
        table.data-table { width: 100%; border-collapse: collapse; margin-top: 8px; border: 1px solid #cbd5e1; }
        table.data-table th { background-color: #1e293b; color: #ffffff; padding: 6px 8px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; border: 1px solid #334155; text-align: left; }
        table.data-table td { padding: 4px 8px; border: 1px solid #e2e8f0; vertical-align: middle; }

        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .text-center { text-align: center; }
        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

        .indent-1 { padding-left: 14px !important; }
        .indent-2 { padding-left: 24px !important; }
        .indent-3 { padding-left: 34px !important; }
        .indent-4 { padding-left: 44px !important; }

        .brand-row { background-color: #e2e8f0; font-weight: 800; color: #0f172a; font-size: 10.5px; }
        .brand-row td { border: 1px solid #cbd5e1; }

        .division-row { background-color: #f1f5f9; font-weight: 700; color: #1e293b; font-size: 10px; }
        .division-row td { border: 1px solid #e2e8f0; }

        .gender-row { background-color: #f8fafc; font-weight: 600; color: #334155; font-size: 10px; }
        .gender-row td { border: 1px solid #e2e8f0; }

        .category-row { background-color: #ffffff; font-weight: 600; color: #475569; font-size: 10px; }
        .category-row td { border: 1px solid #e2e8f0; }

        .item-row { background-color: #ffffff; }
        .item-row td { border: 1px solid #e2e8f0; }

        .sku-code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; color: #2563eb; font-size: 10.5px; }
        .barcode-sub { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #059669; font-size: 9.5px; font-weight: 600; margin-top: 1px; }
        .sub-label { color: #64748b; font-weight: 500; font-size: 9px; text-transform: uppercase; }
        .article-name { color: #334155; font-weight: 600; font-size: 10px; margin-top: 1px; }
        .meta-sub { color: #475569; font-size: 9.5px; margin-top: 1px; }
        .swap-tag { color: #d97706; font-size: 9.5px; font-weight: 600; margin-top: 1px; }

        .totals-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .totals-table td { padding: 6px 8px; font-weight: 800; font-size: 11px; border-top: 2px solid #0f172a; border-bottom: 3px double #0f172a; }

        .remarks-box { margin-top: 14px; border: 1px solid #e2e8f0; border-radius: 4px; background-color: #f8fafc; padding: 8px 12px; }
        .remarks-title { font-weight: 700; color: #475569; font-size: 9.5px; text-transform: uppercase; margin-bottom: 3px; }

        .signatures-container { width: 100%; margin-top: 50px; page-break-inside: avoid; }
        .signatures-table { width: 100%; border-collapse: collapse; }
        .signatures-table td { width: 50%; vertical-align: bottom; text-align: center; padding: 0 30px; }
        .sig-line { border-top: 1.5px solid #0f172a; padding-top: 6px; font-size: 10px; }
        .sig-title { font-weight: 700; text-transform: uppercase; color: #475569; font-size: 9.5px; }
        .sig-name { font-weight: 800; color: #0f172a; font-size: 11px; margin-top: 2px; }
        .sig-id { color: #64748b; font-size: 9.5px; font-weight: 500; font-family: monospace; }
      </style>
    </head>
    <body onload="window.print()">
      <table class="header-table">
        <tr>
          <td>
            <div class="company-title">Speed (Private) Limited</div>
            <div class="document-title">Stock Adjustment Note</div>
          </td>
          <td class="brand-header">${primaryBrandName}</td>
        </tr>
      </table>

      <div class="meta-card">
        <table class="meta-grid">
          <tr>
            <td style="width: 55%;">
              <table style="width: 100%;">
                <tr>
                  <td class="meta-label">Financial Year:</td>
                  <td class="meta-val">2026</td>
                </tr>
                <tr>
                  <td class="meta-label">Adjusted Location:</td>
                  <td class="meta-val">${locationName}</td>
                </tr>
                <tr>
                  <td class="meta-label">S.A.N. Ref No:</td>
                  <td class="meta-val" style="color: #2563eb;">${refNo}</td>
                </tr>
                <tr>
                  <td class="meta-label">Requester Name:</td>
                  <td class="meta-val">${requesterName} ${requesterId ? `<span style="color:#64748b; font-weight:normal; font-size:9.5px;">(${requesterId})</span>` : ""}</td>
                </tr>
                <tr>
                  <td class="meta-label">Reason / Purpose:</td>
                  <td class="meta-val">${adj.reason || "Stock Count Adjustment"}</td>
                </tr>
              </table>
            </td>
            <td style="width: 45%; text-align: right; vertical-align: top;">
              <table style="width: 100%;">
                <tr>
                  <td class="meta-label" style="text-align: right; padding-right: 8px;">Date:</td>
                  <td class="meta-val" style="text-align: left; width: 90px;">${dateStr}</td>
                </tr>
              </table>
              <div style="margin-top: 10px; text-align: right;">
                <div class="status-badge">${statusLabel}</div>
              </div>
            </td>
          </tr>
        </table>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 42%;">Product / SKU</th>
            <th class="text-center" style="width: 13%;">Color</th>
            <th class="text-center" style="width: 10%;">Size</th>
            <th class="text-right" style="width: 10%;">Qty</th>
            <th class="text-right" style="width: 12%;">Price (PKR)</th>
            <th class="text-right" style="width: 13%;">Total (PKR)</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>

      <table class="totals-table">
        <tr>
          <td style="width: 42%;" class="text-left">TOTAL ADJUSTED STOCK</td>
          <td style="width: 13%;"></td>
          <td style="width: 10%;"></td>
          <td style="width: 10%;" class="text-right font-mono">${overallQty}</td>
          <td style="width: 12%;"></td>
          <td style="width: 13%;" class="text-right font-mono">Rs. ${overallVal.toLocaleString("en-PK")}</td>
        </tr>
      </table>

      ${
        adj.notes
          ? `
          <div class="remarks-box">
            <div class="remarks-title">Internal Notes / Instructions</div>
            <div style="font-weight: 500;">${adj.notes}</div>
          </div>
        `
          : ""
      }

      <div class="signatures-container">
        <table class="signatures-table">
          <tr>
            <td>
              <div class="sig-line">
                <div class="sig-title">Prepared / Requested By</div>
                <div class="sig-name">${requesterName}</div>
                ${requesterId ? `<div class="sig-id">ID: ${requesterId}</div>` : ""}
              </div>
            </td>
            <td>
              <div class="sig-line">
                <div class="sig-title">Head Office Approval</div>
                <div class="sig-name">Authorized Signature</div>
                <div class="sig-id">ERP Management</div>
              </div>
            </td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `);
  win.document.close();
}
