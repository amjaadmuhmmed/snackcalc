
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

// --- Stock Management ---
export async function updateStockQuantities(
    itemsToUpdate: Array<{ itemId: string; quantityChange: number }>
): Promise<{ success: boolean; message?: string }> {
    if (itemsToUpdate.length === 0) {
        return { success: true, message: "No stock changes to apply." };
    }
    const batch = writeBatch(db);
    try {
        for (const { itemId, quantityChange } of itemsToUpdate) {
            if (!itemId) {
                console.warn("Skipping stock update for an item without an ID.");
                continue;
            }
            if (quantityChange === 0) {
                continue;
            }
            const itemDocRef = doc(db, 'snack', itemId);
            const itemDocSnap = await firestoreGetDoc(itemDocRef);

            if (!itemDocSnap.exists()) {
                console.error(`Item with ID ${itemId} not found for stock update. Cannot apply change of ${quantityChange}.`);
                throw new Error(`Item with ID ${itemId} not found. Stock update failed.`);
            }
            const currentStock = Number(itemDocSnap.data().stockQuantity) || 0;
            const newStock = currentStock + quantityChange;
            batch.update(itemDocRef, { stockQuantity: newStock });
        }
        await batch.commit();
        return { success: true };
    } catch (error: any) {
        console.error('Stock quantity update failed: ', error);
        return { success: false, message: error.message || 'Stock quantity update failed.' };
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
    customerId?: string;
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
        customerId: bill.customerId || '',
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
            customerId: bill.customerId || '',
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
          customerId: data.customerId || '',
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
    supplierId?: string;
    purchaseDate: Timestamp | Date;
    items: PurchaseItem[];
    totalAmount: number;
    notes?: string;
    createdAt: Timestamp | Date;
    lastUpdatedAt?: Timestamp | Date;
}

export interface PurchaseInput extends Omit<Purchase, 'id' | 'createdAt' | 'lastUpdatedAt'> {}

const purchasesCollection = collection(db, 'purchases');

export async function addPurchaseToDb(purchase: PurchaseInput): Promise<{ success: boolean; id?: string; message?: string }> {
    try {
        const dataToSave: { [key: string]: any } = {
            purchaseOrderNumber: purchase.purchaseOrderNumber,
            supplierName: purchase.supplierName || '',
            purchaseDate: purchase.purchaseDate, // User-entered date
            items: purchase.items,
            totalAmount: purchase.totalAmount,
            notes: purchase.notes || '',
            createdAt: serverTimestamp(), // System-generated creation timestamp
        };

        if (purchase.supplierId && typeof purchase.supplierId === 'string' && purchase.supplierId.trim() !== '') {
            dataToSave.supplierId = purchase.supplierId.trim();
        }

        const docRef = await addDoc(purchasesCollection, dataToSave);
        return { success: true, id: docRef.id };
    } catch (e: any) {
        console.error('[DB addPurchaseToDb] Error adding purchase document: ', e);
        return { success: false, message: e.message };
    }
}

export async function updatePurchaseInDb(id: string, purchaseData: PurchaseInput): Promise<{ success: boolean; message?: string }> {
    try {
        const purchaseDocRef = doc(db, 'purchases', id);
        const dataToUpdate: any = {
            ...purchaseData,
            purchaseOrderNumber: purchaseData.purchaseOrderNumber,
            supplierName: purchaseData.supplierName || '',
            supplierId: purchaseData.supplierId || '',
            purchaseDate: purchaseData.purchaseDate, // User-entered date
            items: purchaseData.items,
            totalAmount: purchaseData.totalAmount,
            notes: purchaseData.notes || '',
            lastUpdatedAt: serverTimestamp(),
        };

        await updateDoc(purchaseDocRef, dataToUpdate);
        return { success: true, message: "Purchase order updated successfully." };
    } catch (e: any) {
        console.error(`Error updating purchase document ${id}: `, e);
        return { success: false, message: e.message };
    }
}


export async function updateStockAfterPurchase(
    purchaseItems: PurchaseItem[]
): Promise<{ success: boolean; message?: string }> {
    if (purchaseItems.length === 0) {
        return { success: true, message: "No items to update stock for." };
    }
    const stockAdjustments = purchaseItems.map(pItem => ({
        itemId: pItem.itemId,
        quantityChange: pItem.quantity
    }));
    return updateStockQuantities(stockAdjustments);
}

export async function getPurchasesFromDb(supplierId?: string): Promise<Purchase[]> {
    try {
      let purchasesQuery;
      if (supplierId) {
        purchasesQuery = query(purchasesCollection, where("supplierId", "==", supplierId), orderBy('purchaseDate', 'desc'));
      } else {
        purchasesQuery = query(purchasesCollection, orderBy('purchaseDate', 'desc'));
      }
      const purchaseSnapshot = await getDocs(purchasesQuery);

      if (supplierId && purchaseSnapshot.empty) {
        console.warn(`[DB getPurchasesFromDb] No purchases found for supplierId "${supplierId}".`);
      }

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
          supplierId: data.supplierId || '',
          purchaseDate: data.purchaseDate, // User-entered date
          items: items,
          totalAmount: data.totalAmount,
          notes: data.notes || '',
          createdAt: data.createdAt, // System-generated creation timestamp
          lastUpdatedAt: data.lastUpdatedAt,
        } as Purchase;
      });
    } catch (e: any) {
      console.error('[DB getPurchasesFromDb] Error getting purchase documents: ', e);
      return [];
    }
}

export async function getPurchaseByIdFromDb(id: string): Promise<Purchase | null> {
    try {
        const purchaseDocRef = doc(db, 'purchases', id);
        const docSnap = await firestoreGetDoc(purchaseDocRef);

        if (!docSnap.exists()) {
            console.warn(`[DB getPurchaseByIdFromDb] No purchase found for ID "${id}".`);
            return null;
        }

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
            supplierId: data.supplierId || '',
            purchaseDate: data.purchaseDate,
            items: items,
            totalAmount: data.totalAmount,
            notes: data.notes || '',
            createdAt: data.createdAt,
            lastUpdatedAt: data.lastUpdatedAt,
        } as Purchase;

    } catch (e: any) {
        console.error(`[DB getPurchaseByIdFromDb] Error getting purchase document for ID ${id}: `, e);
        return null;
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
        const q = query(suppliersCollection, where("name_lowercase", "==", supplier.name.trim().toLowerCase()));
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
        const createdSupplierDoc = await firestoreGetDoc(docRef);
        const createdSupplierData = createdSupplierDoc.data();

        const createdSupplier: Supplier = {
             id: docRef.id,
             name: createdSupplierData?.name,
             contactPerson: createdSupplierData?.contactPerson,
             phoneNumber: createdSupplierData?.phoneNumber,
             email: createdSupplierData?.email,
             address: createdSupplierData?.address,
             gstNumber: createdSupplierData?.gstNumber,
             createdAt: createdSupplierData?.createdAt ? (createdSupplierData.createdAt as Timestamp).toDate() : new Date()
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

// --- Customers ---
export interface Customer {
  id: string;
  name: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}
export interface CustomerInput extends Omit<Customer, 'id' | 'createdAt' | 'updatedAt'> {}

const customersCollection = collection(db, 'customers');

export async function addCustomerToDb(customer: CustomerInput): Promise<{ success: boolean; id?: string; message?: string; customer?: Customer }> {
    try {
        const q = query(customersCollection, where("name_lowercase", "==", customer.name.trim().toLowerCase()));
        // For now, allow duplicate names, but one might want to add more checks (e.g., name + phone).
        // const querySnapshot = await getDocs(q);
        // if (!querySnapshot.empty) {
        //     return { success: false, message: `Customer with name '${customer.name}' already exists.` };
        // }

        const dataToSave: any = {
            name: customer.name.trim(),
            name_lowercase: customer.name.trim().toLowerCase(),
            phoneNumber: customer.phoneNumber || '',
            email: customer.email || '',
            address: customer.address || '',
            createdAt: serverTimestamp()
        };

        const docRef = await addDoc(customersCollection, dataToSave);
        const createdCustomerDoc = await firestoreGetDoc(docRef);
        const createdCustomerData = createdCustomerDoc.data();

        const newCustomer: Customer = {
             id: docRef.id,
             name: createdCustomerData?.name,
             phoneNumber: createdCustomerData?.phoneNumber,
             email: createdCustomerData?.email,
             address: createdCustomerData?.address,
             createdAt: createdCustomerData?.createdAt ? (createdCustomerData.createdAt as Timestamp).toDate() : new Date()
        };
        return { success: true, id: docRef.id, customer: newCustomer };
    } catch (e: any) {
        console.error('Error adding customer document: ', e);
        return { success: false, message: e.message };
    }
}

export async function updateCustomerInDb(id: string, customerData: Partial<CustomerInput>): Promise<{ success: boolean; message?: string }> {
    try {
        const customerDocRef = doc(db, 'customers', id);
        const dataToUpdate: any = { ...customerData };

        if (customerData.name) {
            dataToUpdate.name = customerData.name.trim();
            dataToUpdate.name_lowercase = customerData.name.trim().toLowerCase();
        }
        if (customerData.phoneNumber !== undefined) dataToUpdate.phoneNumber = customerData.phoneNumber || '';
        if (customerData.email !== undefined) dataToUpdate.email = customerData.email || '';
        if (customerData.address !== undefined) dataToUpdate.address = customerData.address || '';

        dataToUpdate.updatedAt = serverTimestamp();

        await updateDoc(customerDocRef, dataToUpdate);
        return { success: true, message: "Customer updated successfully." };
    } catch (e: any) {
        console.error(`Error updating customer document ${id}: `, e);
        return { success: false, message: e.message };
    }
}

export async function getCustomersFromDb(): Promise<Customer[]> {
    try {
        const customersQuery = query(customersCollection, orderBy('name'));
        const customerSnapshot = await getDocs(customersQuery);
        return customerSnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                name: data.name || 'Unnamed Customer',
                phoneNumber: data.phoneNumber || '',
                email: data.email || '',
                address: data.address || '',
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
            } as Customer;
        });
    } catch (e: any) {
        console.error('Error getting customer documents: ', e);
        return [];
    }
}


export { firestoreGetDoc as getDoc };

