'use server';

import {addSnackToDb, getSnacksFromDb, updateSnackInDb, deleteSnackFromDb, addBillToDb, getBillsFromDb, BillInput} from '@/lib/db';
import {revalidatePath} from 'next/cache';

// --- Snack Actions ---

export async function addSnack(data: FormData) {
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

    const newSnack = {
      name,
      price: parsedPrice,
      category,
    };

    const result = await addSnackToDb(newSnack);

    if (result.success) {
      revalidatePath('/'); // Clear the cache to update the snacks list on the main page
      revalidatePath('/bills'); // Also revalidate bills page if needed
      return {success: true, message: 'Snack added successfully!'};
    } else {
      return {success: false, message: result.message || 'Failed to add snack.'};
    }
  } catch (error: any) {
    console.error('Error adding snack:', error);
    return { success: false, message: error.message || 'An unexpected error occurred.' };
  }
}

export async function updateSnack(id: string, data: FormData) {
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

    const updatedSnack = {
      name,
      price: parsedPrice,
      category,
    };

    const result = await updateSnackInDb(id, updatedSnack);

    if (result.success) {
      revalidatePath('/'); // Clear the cache to update the snacks
      revalidatePath('/bills');
      return {success: true, message: 'Snack updated successfully!'};
    } else {
      return {success: false, message: result.message || 'Failed to update snack.'};
    }
  } catch (error: any) {
    console.error('Error updating snack:', error);
    return { success: false, message: error.message || 'An unexpected error occurred.' };
  }
}

export async function deleteSnack(id: string) {
  try {
    const result = await deleteSnackFromDb(id);

    if (result.success) {
      revalidatePath('/'); // Clear the cache to update the snacks
      revalidatePath('/bills');
      return {success: true, message: 'Snack deleted successfully!'};
    } else {
      return {success: false, message: result.message || 'Failed to delete snack.'};
    }
  } catch (error: any) {
    console.error('Error deleting snack:', error);
    return { success: false, message: error.message || 'An unexpected error occurred.' };
  }
}

export async function getSnacks() { // Renamed to avoid conflict if needed elsewhere
  return getSnacksFromDb();
}

// --- Bill Actions ---

export async function saveBill(billData: BillInput) {
    try {
        const result = await addBillToDb(billData);
        if (result.success) {
            revalidatePath('/bills'); // Revalidate the bills page to show the new bill
            return { success: true, message: 'Bill saved successfully!' };
        } else {
            return { success: false, message: result.message || 'Failed to save bill.' };
        }
    } catch (error: any) {
        console.error('Error saving bill:', error);
        return { success: false, message: error.message || 'An unexpected error occurred.' };
    }
}

export async function getBills() {
    return getBillsFromDb();
}