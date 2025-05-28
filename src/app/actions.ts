
'use server';

import {addItemToDb, getItemsFromDb, updateItemInDb, deleteItemFromDb, addBillToDb, updateBillInDb, getBillsFromDb, BillInput, SnackInput, BillItem as DbBillItem, Bill, updateStockQuantitiesForBill, getDoc } from '@/lib/db';
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
      return {success: true, message: 'Item added successfully!'};
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
    
    const parsedStockQuantity = stockQuantityString ? parseInt(stockQuantityString, 10) : undefined; // Keep as undefined if not provided
    if (parsedStockQuantity !== undefined && (isNaN(parsedStockQuantity) || parsedStockQuantity < 0)) {
        return { success: false, message: 'Invalid input: Stock Quantity must be a non-negative integer if provided.' };
    }

    const itemToUpdate: Partial<SnackInput> = {
      name,
      price: parsedPrice,
      category,
    };
    if (parsedCost !== undefined) itemToUpdate.cost = parsedCost;
    if (itemCode !== null) itemToUpdate.itemCode = itemCode || undefined; // Ensure empty string is stored as undefined if desired, or just itemCode
    if (parsedStockQuantity !== undefined) itemToUpdate.stockQuantity = parsedStockQuantity;


    const result = await updateItemInDb(id, itemToUpdate);

    if (result.success) {
      revalidatePath('/');
      revalidatePath('/bills');
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
    // Before deleting, consider if stock should be handled or if related bills prevent deletion.
    // For now, direct deletion.
    const result = await deleteItemFromDb(id);

    if (result.success) {
      revalidatePath('/');
      revalidatePath('/bills');
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

        // Calculate stock changes
        const stockAdjustments: Array<{ itemId: string; quantityChange: number }> = [];
        const currentBillItemsMap = new Map(itemsInCurrentBill.map(item => [item.itemId, item.quantity]));
        const oldBillItemsMap = new Map(oldBillItems.map(item => [item.itemId, item.quantity]));
        const allInvolvedItemIds = new Set([...currentBillItemsMap.keys(), ...oldBillItemsMap.keys()]);

        allInvolvedItemIds.forEach(itemId => {
            if (!itemId) return; // Should not happen if item IDs are always present
            const newQty = currentBillItemsMap.get(itemId) || 0;
            const oldQty = oldBillItemsMap.get(itemId) || 0;
            const quantityDelta = newQty - oldQty; // Positive if more sold, negative if items returned/reduced

            if (quantityDelta !== 0) {
                stockAdjustments.push({ itemId, quantityChange: quantityDelta });
            }
        });
        
        // Save or Update the bill document
        if (billIdToUpdate) {
            billActionResult = await updateBillInDb(billIdToUpdate, billData);
        } else {
            const addResult = await addBillToDb(billData);
            billActionResult = {success: addResult.success, message: addResult.message};
            if(addResult.success && addResult.id){
                newBillId = addResult.id;
            }
        }

        // If bill operation was successful, proceed with stock update
        if (billActionResult.success) {
            if (stockAdjustments.length > 0) {
                const stockUpdateResult = await updateStockQuantitiesForBill(stockAdjustments);
                if (!stockUpdateResult.success) {
                    stockUpdateResultMessage = stockUpdateResult.message || "Stock update failed.";
                    console.warn(`Bill ${billIdToUpdate || newBillId} action successful, but stock update failed: ${stockUpdateResultMessage}`);
                }
            }
            
            revalidatePath('/bills');
            revalidatePath('/'); // Revalidate item list for potential stock changes
            
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

    