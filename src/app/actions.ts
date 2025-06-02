
'use server';

import {
    addItemToDb,
    getItemsFromDb,
    updateItemInDb,
    deleteItemFromDb,
    addBillToDb,
    updateBillInDb,
    getBillsFromDb,
    BillInput,
    SnackInput,
    BillItem as DbBillItem,
    Bill,
    updateStockQuantitiesForBill,
    PurchaseInput,
    addPurchaseToDb,
    updateStockAfterPurchase,
    PurchaseItem,
    getPurchasesFromDb,
    SupplierInput,
    addSupplierToDb,
    getSuppliersFromDb,
    updateSupplierInDb,
    Supplier,
    getDoc
} from '@/lib/db';
import {revalidatePath} from 'next/cache';
import { db } from '@/lib/firebase'; // For getDoc
import { doc } from 'firebase/firestore';


// --- Item Actions ---

export async function addItem(data: FormData) {
  try {
    const name = data.get('name') as string;
    const price = data.get('price') as string;
    const category = data.get('category') as string;
    const costString = data.get('cost') as string | null;
    const itemCode = data.get('itemCode') as string | null;
    const stockQuantityString = data.get('stockQuantity') as string | null;

    if (!name || !price || !category) {
      return {success: false, message: 'Invalid input: Name, Price, and Category are required.'};
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return {success: false, message: 'Invalid input: Price must be a positive number.'};
    }

    let parsedCost: number | undefined = undefined;
    if (costString && costString.trim() !== "") {
      parsedCost = parseFloat(costString);
      if (isNaN(parsedCost) || parsedCost < 0) {
        return {success: false, message: 'Invalid input: Cost must be a non-negative number if provided.'};
      }
    }
    
    const parsedStockQuantity = stockQuantityString ? parseInt(stockQuantityString, 10) : 0;
    if (isNaN(parsedStockQuantity) || parsedStockQuantity < 0) {
        return { success: false, message: 'Invalid input: Stock Quantity must be a non-negative integer.' };
    }


    const newItem: SnackInput = {
      name,
      price: parsedPrice,
      category,
      cost: parsedCost,
      itemCode: itemCode || undefined,
      stockQuantity: parsedStockQuantity,
    };

    const result = await addItemToDb(newItem);

    if (result.success) {
      revalidatePath('/');
      revalidatePath('/bills');
      revalidatePath('/purchases/create'); 
      revalidatePath('/purchases/history');
      revalidatePath('/suppliers');
      return {success: true, message: 'Item added successfully!', id: result.id};
    } else {
      return {success: false, message: result.message || 'Failed to add item.'};
    }
  } catch (error: any) {
    console.error('Error adding item:', error);
    return { success: false, message: error.message || 'An unexpected error occurred.' };
  }
}

export async function updateItem(id: string, data: FormData) {
  try {
    const name = data.get('name') as string;
    const price = data.get('price') as string;
    const category = data.get('category') as string;
    const costString = data.get('cost') as string | null;
    const itemCode = data.get('itemCode') as string | null;
    const stockQuantityString = data.get('stockQuantity') as string | null;

    if (!name || !price || !category) {
      return {success: false, message: 'Invalid input: Name, Price, and Category are required.'};
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return {success: false, message: 'Invalid input: Price must be a positive number.'};
    }
    
    let parsedCost: number | undefined = undefined;
    if (costString && costString.trim() !== "") {
      parsedCost = parseFloat(costString);
      if (isNaN(parsedCost) || parsedCost < 0) {
        return {success: false, message: 'Invalid input: Cost must be a non-negative number if provided.'};
      }
    }
    
    const parsedStockQuantity = stockQuantityString ? parseInt(stockQuantityString, 10) : undefined;
    if (parsedStockQuantity !== undefined && (isNaN(parsedStockQuantity) || parsedStockQuantity < 0)) {
        return { success: false, message: 'Invalid input: Stock Quantity must be a non-negative integer if provided.' };
    }

    const itemToUpdate: Partial<SnackInput> = {
      name,
      price: parsedPrice,
      category,
    };
    if (parsedCost !== undefined) itemToUpdate.cost = parsedCost;
    if (itemCode !== null) itemToUpdate.itemCode = itemCode || undefined;
    if (parsedStockQuantity !== undefined) itemToUpdate.stockQuantity = parsedStockQuantity;


    const result = await updateItemInDb(id, itemToUpdate);

    if (result.success) {
      revalidatePath('/');
      revalidatePath('/bills');
      revalidatePath('/purchases/create');
      revalidatePath('/purchases/history');
      revalidatePath('/suppliers');
      return {success: true, message: 'Item updated successfully!'};
    } else {
      return {success: false, message: result.message || 'Failed to update item.'};
    }
  } catch (error: any) {
    console.error('Error updating item:', error);
    return { success: false, message: error.message || 'An unexpected error occurred.' };
  }
}

export async function deleteItem(id: string) {
  try {
    const result = await deleteItemFromDb(id);

    if (result.success) {
      revalidatePath('/');
      revalidatePath('/bills');
      revalidatePath('/purchases/create');
      revalidatePath('/purchases/history');
      revalidatePath('/suppliers');
      return {success: true, message: 'Item deleted successfully!'};
    } else {
      return {success: false, message: result.message || 'Failed to delete item.'};
    }
  } catch (error: any) {
    console.error('Error deleting item:', error);
    return { success: false, message: error.message || 'An unexpected error occurred.' };
  }
}

export async function getItems() {
  return getItemsFromDb();
}

// --- Bill Actions ---

export async function saveBill(billData: BillInput, billIdToUpdate?: string) {
    try {
        let billActionResult;
        let newBillId: string | undefined = undefined;
        let stockUpdateResultMessage: string | undefined;

        const itemsInCurrentBill = billData.items;
        let oldBillItems: DbBillItem[] = [];

        if (billIdToUpdate) {
            const oldBillDoc = await getDoc(doc(db, 'bills', billIdToUpdate));
            if (oldBillDoc.exists()) {
                oldBillItems = (oldBillDoc.data()?.items || []).map((item: any) => ({
                    itemId: item.itemId || '',
                    name: item.name || '',
                    price: Number(item.price) || 0,
                    quantity: Number(item.quantity) || 0,
                    itemCode: item.itemCode || '',
                }));
            }
        }

        const stockAdjustments: Array<{ itemId: string; quantityChange: number }> = [];
        const currentBillItemsMap = new Map(itemsInCurrentBill.map(item => [item.itemId, item.quantity]));
        const oldBillItemsMap = new Map(oldBillItems.map(item => [item.itemId, item.quantity]));
        const allInvolvedItemIds = new Set([...currentBillItemsMap.keys(), ...oldBillItemsMap.keys()]);

        allInvolvedItemIds.forEach(itemId => {
            if (!itemId) return;
            const newQty = currentBillItemsMap.get(itemId) || 0;
            const oldQty = oldBillItemsMap.get(itemId) || 0;
            const quantityDelta = newQty - oldQty; // For sales, positive delta means more sold (stock decreases)

            if (quantityDelta !== 0) {
                 // For sales, quantityChange to updateStockQuantitiesForBill should represent the amount *sold*
                stockAdjustments.push({ itemId, quantityChange: quantityDelta });
            }
        });
        
        if (billIdToUpdate) {
            billActionResult = await updateBillInDb(billIdToUpdate, billData);
        } else {
            const addResult = await addBillToDb(billData);
            billActionResult = {success: addResult.success, message: addResult.message};
            if(addResult.success && addResult.id){
                newBillId = addResult.id;
            }
        }

        if (billActionResult.success) {
            if (stockAdjustments.length > 0) {
                // Pass the net change; updateStockQuantitiesForBill will subtract this from current stock
                const stockUpdateResult = await updateStockQuantitiesForBill(stockAdjustments);
                if (!stockUpdateResult.success) {
                    stockUpdateResultMessage = stockUpdateResult.message || "Stock update failed.";
                    console.warn(`Bill ${billIdToUpdate || newBillId} action successful, but stock update failed: ${stockUpdateResultMessage}`);
                }
            }
            
            revalidatePath('/bills');
            revalidatePath('/'); 
            revalidatePath('/suppliers');
            
            let finalMessage = billIdToUpdate ? 'Bill updated successfully!' : 'Bill saved successfully!';
            if (stockUpdateResultMessage) {
                finalMessage += ` (Warning: ${stockUpdateResultMessage})`;
            }

            return {
                success: true,
                message: finalMessage,
                billId: billIdToUpdate || newBillId
            };
        } else {
            return { success: false, message: billActionResult.message || (billIdToUpdate ? 'Failed to update bill.' : 'Failed to save bill.') };
        }

    } catch (error: any) {
        console.error('Error in saveBill action:', error);
        return { success: false, message: error.message || 'An unexpected error occurred while saving the bill and updating stock.' };
    }
}


export async function getBills() {
    return getBillsFromDb();
}


// --- Purchase Actions ---
export async function savePurchase(purchaseData: PurchaseInput) {
    try {
        const purchaseResult = await addPurchaseToDb(purchaseData);
        if (!purchaseResult.success || !purchaseResult.id) {
            return { success: false, message: purchaseResult.message || 'Failed to save purchase order.' };
        }

        const stockUpdateResult = await updateStockAfterPurchase(purchaseData.items);
        if (!stockUpdateResult.success) {
            console.warn(`Purchase ${purchaseResult.id} saved, but stock update failed: ${stockUpdateResult.message}`);
            return {
                success: true, 
                message: `Purchase saved successfully, but failed to update stock levels. Please verify stock manually. Error: ${stockUpdateResult.message}`,
                purchaseId: purchaseResult.id
            };
        }

        revalidatePath('/'); 
        revalidatePath('/purchases/create');
        revalidatePath('/purchases/history');
        revalidatePath('/suppliers');

        return {
            success: true,
            message: 'Purchase saved and stock updated successfully!',
            purchaseId: purchaseResult.id
        };

    } catch (error: any) {
        console.error('Error in savePurchase action:', error);
        return { success: false, message: error.message || 'An unexpected error occurred while saving the purchase.' };
    }
}

export async function getPurchases() {
    return getPurchasesFromDb();
}


// --- Supplier Actions ---
export async function addSupplier(data: FormData): Promise<{ success: boolean; id?: string; supplier?: Supplier; message?: string }> {
    try {
        const name = data.get('name') as string;
        if (!name || name.trim() === "") {
            return { success: false, message: 'Supplier name cannot be empty.' };
        }

        const newSupplier: SupplierInput = {
          name: name.trim(),
          contactPerson: (data.get('contactPerson') as string) || '',
          phoneNumber: (data.get('phoneNumber') as string) || '',
          email: (data.get('email') as string) || '',
          address: (data.get('address') as string) || '',
          gstNumber: (data.get('gstNumber') as string) || '',
        };
        const result = await addSupplierToDb(newSupplier);

        if (result.success && result.id && result.supplier) {
            revalidatePath('/purchases/create');
            revalidatePath('/suppliers');
            return { success: true, message: 'Supplier added successfully!', id: result.id, supplier: result.supplier};
        } else {
            return { success: false, message: result.message || 'Failed to add supplier.' };
        }
    } catch (error: any) {
        console.error('Error adding supplier:', error);
        return { success: false, message: error.message || 'An unexpected error occurred while adding supplier.' };
    }
}

export async function updateSupplier(id: string, data: FormData): Promise<{ success: boolean; message?: string }> {
    try {
        const name = data.get('name') as string;
        if (!name || name.trim() === "") {
            return { success: false, message: 'Supplier name cannot be empty.' };
        }

        const supplierUpdate: Partial<SupplierInput> = {
            name: name.trim(),
            contactPerson: (data.get('contactPerson') as string | null) || undefined,
            phoneNumber: (data.get('phoneNumber') as string | null) || undefined,
            email: (data.get('email') as string | null) || undefined,
            address: (data.get('address') as string | null) || undefined,
            gstNumber: (data.get('gstNumber') as string | null) || undefined,
        };

        // Filter out any null values passed from form if field was intended to be cleared but not explicitly set to empty string.
        // Firestore update with `undefined` will not change the field, whereas `''` will set it to empty.
        Object.keys(supplierUpdate).forEach(key => {
            const typedKey = key as keyof Partial<SupplierInput>;
            if (supplierUpdate[typedKey] === null) {
                supplierUpdate[typedKey] = ''; // Explicitly set to empty string if cleared in form
            }
        });


        const result = await updateSupplierInDb(id, supplierUpdate);

        if (result.success) {
            revalidatePath('/suppliers');
            revalidatePath('/purchases/create'); // In case supplier name was changed and it's listed there
            return { success: true, message: 'Supplier updated successfully!' };
        } else {
            return { success: false, message: result.message || 'Failed to update supplier.' };
        }
    } catch (error: any) {
        console.error('Error updating supplier:', error);
        return { success: false, message: error.message || 'An unexpected error occurred while updating supplier.' };
    }
}


export async function getSuppliers(): Promise<Supplier[]> {
    return getSuppliersFromDb();
}
