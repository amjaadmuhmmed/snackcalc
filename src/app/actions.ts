
'use server';

import {addSnackToDb, getSnacksFromDb, updateSnackInDb, deleteSnackFromDb, addBillToDb, updateBillInDb, getBillsFromDb, BillInput} from '@/lib/db';
import {revalidatePath} from 'next/cache';

// --- Item Actions (formerly Snack Actions) ---

export async function addSnack(data: FormData) { // Internal function name remains addSnack
  try {
    const name = data.get('name') as string;
    const price = data.get('price') as string;
    const category = data.get('category') as string;

    if (!name || !price || !category) {
      return {success: false, message: 'Invalid input: All fields are required.'};
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return {success: false, message: 'Invalid input: Price must be a positive number.'};
    }

    const newItem = { // Renamed variable
      name,
      price: parsedPrice,
      category,
    };

    const result = await addSnackToDb(newItem); // Pass newItem

    if (result.success) {
      revalidatePath('/'); 
      revalidatePath('/bills'); 
      return {success: true, message: 'Item added successfully!'}; // Changed message
    } else {
      return {success: false, message: result.message || 'Failed to add item.'}; // Changed message
    }
  } catch (error: any) {
    console.error('Error adding item:', error); // Changed message
    return { success: false, message: error.message || 'An unexpected error occurred.' };
  }
}

export async function updateSnack(id: string, data: FormData) { // Internal function name remains updateSnack
  try {
    const name = data.get('name') as string;
    const price = data.get('price') as string;
    const category = data.get('category') as string;

    if (!name || !price || !category) {
      return {success: false, message: 'Invalid input: All fields are required.'};
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return {success: false, message: 'Invalid input: Price must be a positive number.'};
    }

    const updatedItem = { // Renamed variable
      name,
      price: parsedPrice,
      category,
    };

    const result = await updateSnackInDb(id, updatedItem); // Pass updatedItem

    if (result.success) {
      revalidatePath('/'); 
      revalidatePath('/bills');
      return {success: true, message: 'Item updated successfully!'}; // Changed message
    } else {
      return {success: false, message: result.message || 'Failed to update item.'}; // Changed message
    }
  } catch (error: any) {
    console.error('Error updating item:', error); // Changed message
    return { success: false, message: error.message || 'An unexpected error occurred.' };
  }
}

export async function deleteSnack(id: string) { // Internal function name remains deleteSnack
  try {
    const result = await deleteSnackFromDb(id);

    if (result.success) {
      revalidatePath('/'); 
      revalidatePath('/bills');
      return {success: true, message: 'Item deleted successfully!'}; // Changed message
    } else {
      return {success: false, message: result.message || 'Failed to delete item.'}; // Changed message
    }
  } catch (error: any) {
    console.error('Error deleting item:', error); // Changed message
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
