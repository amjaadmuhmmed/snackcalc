
// src/lib/rt_db.ts
'use client'; // Needed for onValue, set, ref from Firebase SDK client-side

import { ref, onValue, set, serverTimestamp } from 'firebase/database';
import type { Unsubscribe, Database } from 'firebase/database';
import { rtDb } from './firebase'; // Import the initialized RTDB instance

const SHARED_ORDERS_PATH = 'shared_orders';
const RTDB_TIMEOUT_MS = 10000; // 10 seconds timeout for RTDB operations

// Interface for items within a shared order
export interface SharedOrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  itemCode?: string; // Added itemCode
}

// Interface for the entire shared order data stored in RTDB
export interface SharedOrderData {
  orderNumber: string;
  items: SharedOrderItem[];
  serviceCharge: number;
  customerName: string;
  customerPhoneNumber: string;
  tableNumber?: string;
  notes?: string; // Optional notes
  lastUpdatedAt: object; // Firebase server timestamp placeholder
}

// Interface for the data when subscribing (lastUpdatedAt will be a number)
export interface SharedOrderDataSnapshot extends Omit<SharedOrderData, 'lastUpdatedAt'> {
  lastUpdatedAt: number;
}


// Function to subscribe to a specific shared order
export function subscribeToSharedOrder(
  orderNumber: string,
  callback: (state: SharedOrderDataSnapshot | null) => void
): Unsubscribe {
  const orderRef = ref(rtDb, `${SHARED_ORDERS_PATH}/${orderNumber}`);
  const unsubscribe = onValue(orderRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val() as SharedOrderDataSnapshot);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error(`Error subscribing to shared order ${orderNumber}:`, error);
    callback(null);
  });
  return unsubscribe;
}

// Function to set or update a shared order in RTDB
export async function setSharedOrderInRTDB(orderNumber: string, billData: Omit<SharedOrderData, 'lastUpdatedAt' | 'orderNumber'>): Promise<void> {
  console.log("RTDB: Attempting to set data for order:", orderNumber);
  const orderRef = ref(rtDb, `${SHARED_ORDERS_PATH}/${orderNumber}`);
  const dataToSet: SharedOrderData = {
    ...billData,
    orderNumber: orderNumber,
    tableNumber: billData.tableNumber || '',
    notes: billData.notes || '', // Include notes
    lastUpdatedAt: serverTimestamp(),
  };

  const setPromise = set(orderRef, dataToSet);
  const timeoutPromise = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error(`RTDB set operation timed out after ${RTDB_TIMEOUT_MS}ms for order ${orderNumber}`)), RTDB_TIMEOUT_MS)
  );

  try {
    await Promise.race([setPromise, timeoutPromise]);
    console.log(`RTDB: Shared order ${orderNumber} updated in RTDB.`);
  } catch (error) {
    console.error(`RTDB: Failed to update shared order ${orderNumber} in RTDB:`, error);
    throw error;
  }
}


// --- Existing functions for temporary sharing (can be deprecated or kept for other purposes) ---
const RTDB_BILLS_PATH = 'shared_bills'; // Temporary shared bills

export interface SharedBillState {
  items: { id: string; name: string; price: number; quantity: number; itemCode?: string; }[]; // Added itemCode
  serviceCharge: number;
  customerName: string;
  customerPhoneNumber: string;
  tableNumber?: string;
  notes?: string; // Optional notes
  orderNumber: string; // This is also the key in RTDB
}

export function subscribeToBillState(
  orderNumber: string,
  callback: (state: SharedBillState | null) => void
): Unsubscribe {
  const billRef = ref(rtDb, `${RTDB_BILLS_PATH}/${orderNumber}`);
  const unsubscribe = onValue(billRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val() as SharedBillState);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error(`Error subscribing to bill ${orderNumber}:`, error);
    callback(null);
  });
  return unsubscribe;
}

export async function updateBillInRTDB(orderNumber: string, billData: SharedBillState): Promise<void> {
  console.log("RTDB: Attempting to set data for (legacy) shared_bill:", orderNumber);
  const billRef = ref(rtDb, `${RTDB_BILLS_PATH}/${orderNumber}`);

  const setPromise = set(billRef, billData);
  const timeoutPromise = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error(`RTDB set operation (legacy shared_bill) timed out after ${RTDB_TIMEOUT_MS}ms for order ${orderNumber}`)), RTDB_TIMEOUT_MS)
  );

  try {
    await Promise.race([setPromise, timeoutPromise]);
    console.log(`RTDB: (Legacy) Shared bill ${orderNumber} updated in RTDB.`);
  } catch (error) {
    console.error(`RTDB: Failed to update (legacy) shared bill ${orderNumber} in RTDB:`, error);
    throw error;
  }
}
