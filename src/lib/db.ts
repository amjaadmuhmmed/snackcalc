
'use server';

import {db} from './firebase';
import {collection, addDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, Timestamp, runTransaction, DocumentReference, writeBatch, getDoc as firestoreGetDoc, where} from 'firebase/firestore';

// --- Items (formerly Snacks) ---

export interface Snack { // Internal interface name remains Snack for now
  id: string;
  name: string;
  category: string;
  price: number;
  cost?: number;
  itemCode?: string;
  stockQuantity: number;
}

export interface SnackInput extends Omit<Snack, 'id'> {}

const itemsCollection = collection(db, 'snack');

export async function addItemToDb(item: SnackInput) {
  try {
    const itemData = {
      ...item,
      price: Number(item.price) || 0,
      cost: item.cost !== undefined && String(item.cost).trim() !== "" ? Number(item.cost) : undefined,
      itemCode: item.itemCode || '',
      stockQuantity: Number(item.stockQuantity) || 0,
    };
    const docRef = await addDoc(itemsCollection, itemData);
    return {success: true, id: docRef.id};
  } catch (e: any) {
    console.error('Error adding item document: ', e);
    return {success: false, message: e.message};
  }
}

export async function updateItemInDb(id: string, item: Partial<SnackInput>) {
  try {
    const itemData: any = {};
    if (item.name !== undefined) itemData.name = item.name;
    if (item.price !== undefined) itemData.price = Number(item.price) || 0;
    if (item.category !== undefined) itemData.category = item.category;
    if (item.cost !== undefined) {
        itemData.cost = item.cost !== null && String(item.cost).trim() !== "" ? Number(item.cost) : undefined;
    }
    if (item.itemCode !== undefined) itemData.itemCode = item.itemCode || '';
    if (item.stockQuantity !== undefined) itemData.stockQuantity = Number(item.stockQuantity) || 0;

    if (Object.keys(itemData).length === 0) {
      return { success: true, message: "No fields to update." };
    }

    const itemDoc = doc(db, 'snack', id);
    await updateDoc(itemDoc, itemData);
    return {success: true};
  } catch (e: any) {
    console.error('Error updating item document: ', e);
    return {success: false, message: e.message};
  }
}

export async function deleteItemFromDb(id: string) {
  try {
    const itemDoc = doc(db, 'snack', id);
    await deleteDoc(itemDoc);
    return {success: true};
  } catch (e: any) {
    console.error('Error deleting item document: ', e);
    return {success: false, message: e.message};
  }
}

export async function getItemsFromDb(): Promise<Snack[]> {
  try {
    const itemsQuery = query(itemsCollection, orderBy('name'));
    const itemSnapshot = await getDocs(itemsQuery);
    return itemSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const price = Number(data.price);
        const cost = data.cost !== undefined ? Number(data.cost) : undefined;
        const stockQuantity = Number(data.stockQuantity);

        if (isNaN(price)) {
            console.warn(`Document ${docSnap.id} has invalid price: ${data.price}. Setting price to 0.`);
        }
        if (data.cost !== undefined && isNaN(cost!)) {
            console.warn(`Document ${docSnap.id} has invalid cost: ${data.cost}. Setting cost to undefined.`);
        }
        if (isNaN(stockQuantity)) {
            console.warn(`Document ${docSnap.id} has invalid stockQuantity: ${data.stockQuantity}. Setting stock to 0.`);
        }
        return {
          id: docSnap.id,
          name: data.name || 'Unnamed Item',
          category: data.category || 'Uncategorized',
          price: isNaN(price) ? 0 : price,
          cost: data.cost !== undefined && !isNaN(cost!) ? cost : undefined,
          itemCode: data.itemCode || '',
          stockQuantity: isNaN(stockQuantity) ? 0 : stockQuantity,
        } as Snack;
    });
  } catch (e: any) {
    console.error('Error getting item documents: ', e);
    return [];
  }
}


// --- Bills ---

export interface BillItem {
    itemId: string;
    name: string;
    price: number;
    quantity: number;
    itemCode?: string;
}

export interface Bill {
    id: string;
    orderNumber: string;
    customerName?: string;
    customerPhoneNumber?: string;
    tableNumber?: string;
    notes?: string;
    items: BillItem[];
    serviceCharge: number;
    totalAmount: number;
    createdAt: Timestamp | Date;
    lastUpdatedAt?: Timestamp | Date;
}

export interface BillInput extends Omit<Bill, 'id' | 'createdAt' | 'lastUpdatedAt'> {}

const billsCollection = collection(db, 'bills');

export async function addBillToDb(bill: BillInput) {
    try {
      const docRef = await addDoc(billsCollection, {
        ...bill,
        customerName: bill.customerName || '',
        customerPhoneNumber: bill.customerPhoneNumber || '',
        tableNumber: bill.tableNumber || '',
        notes: bill.notes || '',
        createdAt: serverTimestamp()
      });
      return {success: true, id: docRef.id};
    } catch (e: any) {
      console.error('Error adding bill document: ', e);
      return {success: false, message: e.message, id: undefined };
    }
}

export async function updateBillInDb(id: string, bill: BillInput) {
    try {
        const billDoc = doc(db, 'bills', id);
        await updateDoc(billDoc, {
            ...bill,
            customerName: bill.customerName || '',
            customerPhoneNumber: bill.customerPhoneNumber || '',
            tableNumber: bill.tableNumber || '',
            notes: bill.notes || '',
            lastUpdatedAt: serverTimestamp()
        });
        return {success: true};
    } catch (e: any) {
        console.error('Error updating bill document: ', e);
        return {success: false, message: e.message};
    }
}

export async function getBillsFromDb(): Promise<Bill[]> {
    try {
      const billsQuery = query(billsCollection, orderBy('createdAt', 'desc'));
      const billSnapshot = await getDocs(billsQuery);
      return billSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const itemsWithCode = (data.items || []).map((item: any) => ({
          itemId: item.itemId || '',
          name: item.name || 'Unknown Item',
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 0,
          itemCode: item.itemCode || '',
        }));

        return {
          id: docSnap.id,
          orderNumber: data.orderNumber,
          customerName: data.customerName || '',
          customerPhoneNumber: data.customerPhoneNumber || '',
          tableNumber: data.tableNumber || '',
          notes: data.notes || '',
          items: itemsWithCode,
          serviceCharge: data.serviceCharge,
          totalAmount: data.totalAmount,
          createdAt: data.createdAt,
          lastUpdatedAt: data.lastUpdatedAt,
        } as Bill;
      })
    } catch (e: any) {
      console.error('Error getting bill documents: ', e);
      return [];
    }
}

export async function updateStockQuantitiesForBill(
    dbItemsToUpdate: Array<{ itemId: string; quantityChange: number }>
): Promise<{ success: boolean; message?: string }> {
    if (dbItemsToUpdate.length === 0) {
        return { success: true };
    }
    try {
        await runTransaction(db, async (transaction) => {
            for (const { itemId, quantityChange } of dbItemsToUpdate) {
                if (!itemId) {
                    console.warn("Skipping stock update for an item without an ID.");
                    continue;
                }
                const itemDocRef = doc(db, 'snack', itemId);
                const itemDocSnap = await transaction.get(itemDocRef);

                if (!itemDocSnap.exists()) {
                    console.error(`Item with ID ${itemId} not found for stock update.`);
                    throw new Error(`Item with ID ${itemId} not found during stock update.`);
                }

                const currentStock = Number(itemDocSnap.data().stockQuantity) || 0;
                const newStock = currentStock - quantityChange; // Subtract for sales
                transaction.update(itemDocRef, { stockQuantity: newStock });
            }
        });
        return { success: true };
    } catch (error: any) {
        console.error('Stock update transaction failed: ', error);
        return { success: false, message: error.message || 'Stock update transaction failed.' };
    }
}

// --- Purchases ---
export interface PurchaseItem {
    itemId: string;
    name: string;
    quantity: number;
    purchaseCost: number;
    itemCode?: string;
}

export interface Purchase {
    id: string;
    purchaseOrderNumber: string;
    supplierName?: string;
    supplierId?: string; // Added supplierId
    purchaseDate: Timestamp | Date;
    items: PurchaseItem[];
    totalAmount: number;
    notes?: string;
    createdAt: Timestamp | Date;
}

export interface PurchaseInput extends Omit<Purchase, 'id' | 'createdAt'> {}

const purchasesCollection = collection(db, 'purchases');

export async function addPurchaseToDb(purchase: PurchaseInput): Promise<{ success: boolean; id?: string; message?: string }> {
    try {
        const purchaseData: any = {
            ...purchase,
            supplierName: purchase.supplierName || '',
            notes: purchase.notes || '',
            createdAt: serverTimestamp()
        };
        if (purchase.supplierId) {
            purchaseData.supplierId = purchase.supplierId;
        }

        const docRef = await addDoc(purchasesCollection, purchaseData);
        return { success: true, id: docRef.id };
    } catch (e: any) {
        console.error('Error adding purchase document: ', e);
        return { success: false, message: e.message };
    }
}

export async function updateStockAfterPurchase(
    purchaseItems: PurchaseItem[]
): Promise<{ success: boolean; message?: string }> {
    if (purchaseItems.length === 0) {
        return { success: true, message: "No items to update stock for." };
    }
    const batch = writeBatch(db);
    try {
        for (const pItem of purchaseItems) {
            if (!pItem.itemId) {
                console.warn("Skipping stock update for a purchase item without an ID:", pItem.name);
                continue;
            }
            const itemDocRef = doc(db, 'snack', pItem.itemId);
            const itemDocSnap = await firestoreGetDoc(itemDocRef);

            if (!itemDocSnap.exists()) {
                console.error(`Item with ID ${pItem.itemId} (${pItem.name}) not found for stock update.`);
                continue;
            }
            const currentStock = Number(itemDocSnap.data().stockQuantity) || 0;
            const newStock = currentStock + pItem.quantity; // Add for purchases
            batch.update(itemDocRef, { stockQuantity: newStock });
        }
        await batch.commit();
        return { success: true };
    } catch (error: any) {
        console.error('Stock update after purchase failed: ', error);
        return { success: false, message: error.message || 'Stock update after purchase failed.' };
    }
}

export async function getPurchasesFromDb(supplierId?: string): Promise<Purchase[]> {
    try {
      let purchasesQuery;
      if (supplierId) {
        console.log(`[DB getPurchasesFromDb] Querying purchases for supplierId: "${supplierId}"`);
        purchasesQuery = query(purchasesCollection, where("supplierId", "==", supplierId), orderBy('purchaseDate', 'desc'));
      } else {
        console.log(`[DB getPurchasesFromDb] Querying all purchases.`);
        purchasesQuery = query(purchasesCollection, orderBy('purchaseDate', 'desc'));
      }
      const purchaseSnapshot = await getDocs(purchasesQuery);
      console.log(`[DB getPurchasesFromDb] Found ${purchaseSnapshot.docs.length} purchases for supplierId: "${supplierId}"`);
      return purchaseSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const items = (data.items || []).map((item: any) => ({
          itemId: item.itemId || '',
          name: item.name || 'Unknown Item',
          quantity: Number(item.quantity) || 0,
          purchaseCost: Number(item.purchaseCost) || 0,
          itemCode: item.itemCode || '',
        }));

        return {
          id: docSnap.id,
          purchaseOrderNumber: data.purchaseOrderNumber,
          supplierName: data.supplierName || '',
          supplierId: data.supplierId || '', // Include supplierId
          purchaseDate: data.purchaseDate,
          items: items,
          totalAmount: data.totalAmount,
          notes: data.notes || '',
          createdAt: data.createdAt,
        } as Purchase;
      });
    } catch (e: any) {
      console.error('Error getting purchase documents: ', e);
      return [];
    }
}

// --- Suppliers ---
export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}
export interface SupplierInput extends Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'> {}

const suppliersCollection = collection(db, 'suppliers');

export async function addSupplierToDb(supplier: SupplierInput): Promise<{ success: boolean; id?: string; message?: string; supplier?: Supplier }> {
    try {
        const q = query(suppliersCollection, where("name_lowercase", "==", supplier.name.toLowerCase()));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return { success: false, message: `Supplier with name '${supplier.name}' already exists.` };
        }

        const dataToSave: any = {
            ...supplier,
            name: supplier.name.trim(),
            name_lowercase: supplier.name.trim().toLowerCase(),
            contactPerson: supplier.contactPerson || '',
            phoneNumber: supplier.phoneNumber || '',
            email: supplier.email || '',
            address: supplier.address || '',
            gstNumber: supplier.gstNumber || '',
            createdAt: serverTimestamp()
        };

        const docRef = await addDoc(suppliersCollection, dataToSave);
        // Construct the supplier object to return, ensuring createdAt is a usable Date for client
        const createdSupplier: Supplier = {
             id: docRef.id,
             name: dataToSave.name,
             contactPerson: dataToSave.contactPerson,
             phoneNumber: dataToSave.phoneNumber,
             email: dataToSave.email,
             address: dataToSave.address,
             gstNumber: dataToSave.gstNumber,
             createdAt: new Date() // Use current date as placeholder, Firestore will set serverTimestamp
        };
        return { success: true, id: docRef.id, supplier: createdSupplier };
    } catch (e: any) {
        console.error('Error adding supplier document: ', e);
        return { success: false, message: e.message };
    }
}

export async function updateSupplierInDb(id: string, supplierData: Partial<SupplierInput>): Promise<{ success: boolean; message?: string }> {
    try {
        const supplierDocRef = doc(db, 'suppliers', id);
        const dataToUpdate: any = { ...supplierData };

        if (supplierData.name) {
            dataToUpdate.name = supplierData.name.trim();
            dataToUpdate.name_lowercase = supplierData.name.trim().toLowerCase();
        }
        // Ensure empty strings for optional fields if explicitly set to empty
        if (supplierData.contactPerson !== undefined) dataToUpdate.contactPerson = supplierData.contactPerson || '';
        if (supplierData.phoneNumber !== undefined) dataToUpdate.phoneNumber = supplierData.phoneNumber || '';
        if (supplierData.email !== undefined) dataToUpdate.email = supplierData.email || '';
        if (supplierData.address !== undefined) dataToUpdate.address = supplierData.address || '';
        if (supplierData.gstNumber !== undefined) dataToUpdate.gstNumber = supplierData.gstNumber || '';

        dataToUpdate.updatedAt = serverTimestamp();

        await updateDoc(supplierDocRef, dataToUpdate);
        return { success: true, message: "Supplier updated successfully." };
    } catch (e: any) {
        console.error(`Error updating supplier document ${id}: `, e);
        return { success: false, message: e.message };
    }
}


export async function getSuppliersFromDb(): Promise<Supplier[]> {
    try {
        const suppliersQuery = query(suppliersCollection, orderBy('name'));
        const supplierSnapshot = await getDocs(suppliersQuery);
        return supplierSnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                name: data.name || 'Unnamed Supplier',
                contactPerson: data.contactPerson || '',
                phoneNumber: data.phoneNumber || '',
                email: data.email || '',
                address: data.address || '',
                gstNumber: data.gstNumber || '',
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
            } as Supplier;
        });
    } catch (e: any) {
        console.error('Error getting supplier documents: ', e);
        return [];
    }
}


export { firestoreGetDoc as getDoc };
