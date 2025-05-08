// src/lib/rt_db.ts
'use client'; // Needed for onValue, set, ref from Firebase SDK client-side

import { ref, onValue, set, serverTimestamp } from 'firebase/database'; // getDatabase removed
import type { Unsubscribe, Database } from 'firebase/database';
import { rtDb } from './firebase'; // Import the initialized RTDB instance

const SHARED_ORDERS_PATH = 'shared_orders'; // New path for persistent shared orders

// Interface for items within a shared order
export interface SharedOrderItem {
  id: string; // snackId from Firestore
  name: string;
  price: number; // Price at the time of adding
  quantity: number;
}

// Interface for the entire shared order data stored in RTDB
export interface SharedOrderData {
  orderNumber: string; // Should match the key in RTDB
  items: SharedOrderItem[];
  serviceCharge: number;
  customerName: string;
  customerPhoneNumber: string;
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
      callback(null); // No data for this order number
    }
  }, (error) => {
    console.error(`Error subscribing to shared order ${orderNumber}:`, error);
    callback(null); // Propagate error as null state
  });
  return unsubscribe;
}

// Function to set or update a shared order in RTDB
export async function setSharedOrderInRTDB(orderNumber: string, billData: Omit<SharedOrderData, 'lastUpdatedAt' | 'orderNumber'>): Promise<void> {
  const orderRef = ref(rtDb, `${SHARED_ORDERS_PATH}/${orderNumber}`);
  const dataToSet: SharedOrderData = {
    ...billData,
    orderNumber: orderNumber,
    lastUpdatedAt: serverTimestamp(),
  };
  try {
    await set(orderRef, dataToSet);
    console.log(`Shared order ${orderNumber} updated in RTDB.`);
  } catch (error) {
    console.error(`Failed to update shared order ${orderNumber} in RTDB:`, error);
    throw error; // Re-throw to be handled by caller
  }
}


// --- Existing functions for temporary sharing (can be deprecated or kept for other purposes) ---
const RTDB_BILLS_PATH = 'shared_bills'; // Temporary shared bills

export interface SharedBillState {
  items: { id: string; name: string; price: number; quantity: number }[];
  serviceCharge: number;
  customerName: string;
  customerPhoneNumber: string;
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
      callback(null); // No data for this order number
    }
  }, (error) => {
    console.error(`Error subscribing to bill ${orderNumber}:`, error);
    callback(null); // Propagate error as null state
  });
  return unsubscribe;
}

export async function updateBillInRTDB(orderNumber: string, billData: SharedBillState): Promise<void> {
  const billRef = ref(rtDb, `${RTDB_BILLS_PATH}/${orderNumber}`);
  try {
    await set(billRef, billData);
  } catch (error) {
    console.error(`Failed to update bill ${orderNumber} in RTDB:`, error);
    // Optionally, re-throw or handle more gracefully
    throw error;
  }
}
