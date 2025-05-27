
'use server';

import {addSnackToDb, getSnacksFromDb, updateSnackInDb, deleteSnackFromDb, addBillToDb, updateBillInDb, getBillsFromDb, BillInput, SnackInput} from '@/lib/db';
import {revalidatePath} from 'next/cache';

// --- Item Actions ---

export async function addSnack(data: FormData) {
  try {
    const name = data.get('name') as string;
    const price = data.get('price') as string;
    const category = data.get('category') as string;
    const costString = data.get('cost') as string | null;
    const itemCode = data.get('itemCode') as string | null;

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
      if (isNaN(parsedCost) || parsedCost < 0) { // Cost can be 0, but not negative
        return {success: false, message: 'Invalid input: Cost must be a non-negative number if provided.'};
      }
    }

    const newItem: SnackInput = {
      name,
      price: parsedPrice,
      category,
      cost: parsedCost,
      itemCode: itemCode || undefined, // Store as undefined if empty or null
    };

    const result = await addSnackToDb(newItem);

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

export async function updateSnack(id: string, data: FormData) {
  try {
    const name = data.get('name') as string;
    const price = data.get('price') as string;
    const category = data.get('category') as string;
    const costString = data.get('cost') as string | null;
    const itemCode = data.get('itemCode') as string | null;

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

    const updatedItem: SnackInput = {
      name,
      price: parsedPrice,
      category,
      cost: parsedCost,
      itemCode: itemCode || undefined,
    };

    const result = await updateSnackInDb(id, updatedItem);

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

export async function deleteSnack(id: string) {
  try {
    const result = await deleteSnackFromDb(id);

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

export async function getSnacks() {
  return getSnacksFromDb();
}

// --- Bill Actions ---

export async function saveBill(billData: BillInput, billIdToUpdate?: string) {
    try {
        let result;
        let newBillId: string | undefined = undefined;
        if (billIdToUpdate) {
            result = await updateBillInDb(billIdToUpdate, billData);
        } else {
            const addResult = await addBillToDb(billData);
            result = {success: addResult.success, message: addResult.message};
            if(addResult.success && addResult.id){
                newBillId = addResult.id;
            }
        }

        if (result.success) {
            revalidatePath('/bills');
            return {
                success: true,
                message: billIdToUpdate ? 'Bill updated successfully!' : 'Bill saved successfully!',
                billId: billIdToUpdate || newBillId
            };
        } else {
            return { success: false, message: result.message || (billIdToUpdate ? 'Failed to update bill.' : 'Failed to save bill.') };
        }
    } catch (error: any) {
        console.error('Error saving/updating bill:', error);
        return { success: false, message: error.message || 'An unexpected error occurred.' };
    }
}

export async function getBills() {
    return getBillsFromDb();
}
