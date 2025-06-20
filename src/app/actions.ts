
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
    updateStockQuantities, 
    PurchaseInput,
    addPurchaseToDb,
    updatePurchaseInDb,
    updateStockAfterPurchase, 
    PurchaseItem,
    getPurchasesFromDb,
    getPurchaseByIdFromDb,
    SupplierInput,
    addSupplierToDb,
    getSuppliersFromDb,
    updateSupplierInDb,
    Supplier,
    CustomerInput,
    addCustomerToDb,
    getCustomersFromDb,
    updateCustomerInDb,
    Customer,
    getDoc,
    Purchase,
    TransactionInput,
    addTransactionToDb,
    getTransactionsFromDb, // Added
    Transaction, // Added
} from '@/lib/db';
import {revalidatePath} from 'next/cache';
import { db } from '@/lib/firebase'; 
import { doc, Timestamp } from 'firebase/firestore'; // Added Timestamp
import { isValid } from 'date-fns'; // Added


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
      revalidatePath('/customers');
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
      revalidatePath('/customers');
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
      revalidatePath('/customers');
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

        const stockAdjustmentsMap = new Map<string, number>();

        oldBillItems.forEach(item => {
            if (!item.itemId) return;
            stockAdjustmentsMap.set(item.itemId, (stockAdjustmentsMap.get(item.itemId) || 0) + item.quantity); 
        });
        
        itemsInCurrentBill.forEach(item => {
            if (!item.itemId) return;
            stockAdjustmentsMap.set(item.itemId, (stockAdjustmentsMap.get(item.itemId) || 0) - item.quantity); 
        });
        
        const finalStockAdjustments = Array.from(stockAdjustmentsMap.entries())
            .map(([itemId, quantityChange]) => ({ itemId, quantityChange }))
            .filter(adj => adj.quantityChange !== 0);


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
            if (finalStockAdjustments.length > 0) {
                const stockUpdateResult = await updateStockQuantities(finalStockAdjustments); 
                if (!stockUpdateResult.success) {
                    stockUpdateResultMessage = stockUpdateResult.message || "Stock update failed.";
                    console.warn(`Bill ${billIdToUpdate || newBillId} action successful, but stock update failed: ${stockUpdateResultMessage}`);
                }
            }
            
            revalidatePath('/bills');
            revalidatePath('/'); 
            revalidatePath('/suppliers');
            revalidatePath('/customers');
            revalidatePath('/purchases/history'); 
            
            let finalMessage = billIdToUpdate ? 'Bill updated successfully!' : 'Bill saved successfully!';
            if (stockUpdateResultMessage) {
                finalMessage += ` (Warning: ${stockUpdateResultMessage})`;
            } else if (finalStockAdjustments.length > 0) {
                finalMessage += ' Stock levels adjusted.';
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
export async function savePurchase(purchaseData: PurchaseInput, purchaseIdToUpdate?: string) {
    try {
        if (purchaseIdToUpdate) {
            const oldPurchase = await getPurchaseByIdFromDb(purchaseIdToUpdate);
            if (!oldPurchase) {
                return { success: false, message: 'Original purchase order not found for update.' };
            }
            const oldItems = oldPurchase.items;
            const newItems = purchaseData.items;

            const stockAdjustmentsMap = new Map<string, number>();

            
            oldItems.forEach(item => {
                if (!item.itemId) return;
                stockAdjustmentsMap.set(item.itemId, (stockAdjustmentsMap.get(item.itemId) || 0) - item.quantity);
            });

            
            newItems.forEach(item => {
                if (!item.itemId) return;
                stockAdjustmentsMap.set(item.itemId, (stockAdjustmentsMap.get(item.itemId) || 0) + item.quantity);
            });

            const finalStockAdjustments = Array.from(stockAdjustmentsMap.entries())
                .map(([itemId, quantityChange]) => ({ itemId, quantityChange }))
                .filter(adj => adj.quantityChange !== 0);

            let stockUpdateResultMsgPart = "";
            if (finalStockAdjustments.length > 0) {
                const stockUpdateResult = await updateStockQuantities(finalStockAdjustments);
                if (!stockUpdateResult.success) {
                    stockUpdateResultMsgPart = ` However, stock adjustment failed: ${stockUpdateResult.message}. Please verify stock levels manually.`;
                    console.warn(`Purchase ${purchaseIdToUpdate} updated, but stock adjustment failed: ${stockUpdateResult.message}`);
                } else {
                     stockUpdateResultMsgPart = ' Stock levels adjusted accordingly.';
                }
            } else {
                stockUpdateResultMsgPart = " No changes in item quantities, stock levels unaffected by this update.";
            }
            
            const purchaseUpdateResult = await updatePurchaseInDb(purchaseIdToUpdate, purchaseData);
            if (!purchaseUpdateResult.success) {
                return { success: false, message: purchaseUpdateResult.message || 'Failed to update purchase order document.' };
            }
            
            revalidatePath('/purchases/create');
            revalidatePath('/purchases/history');
            revalidatePath('/'); 
            revalidatePath('/suppliers');
            revalidatePath('/customers');

            return {
                success: true,
                message: `Purchase order updated successfully!${stockUpdateResultMsgPart}`,
                purchaseId: purchaseIdToUpdate
            };

        } else {
            
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
            revalidatePath('/customers');

            return {
                success: true,
                message: 'Purchase saved and stock updated successfully!',
                purchaseId: purchaseResult.id
            };
        }

    } catch (error: any) {
        console.error('Error in savePurchase action:', error);
        return { success: false, message: error.message || 'An unexpected error occurred while saving the purchase.' };
    }
}

export async function getPurchases(supplierId?: string): Promise<Purchase[]> {
    return getPurchasesFromDb(supplierId);
}

export async function getPurchaseById(id: string): Promise<Purchase | null> {
    return getPurchaseByIdFromDb(id);
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
            revalidatePath('/customers');
            revalidatePath('/'); 
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
            contactPerson: (data.get('contactPerson') as string) || '', 
            phoneNumber: (data.get('phoneNumber') as string) || '',   
            email: (data.get('email') as string) || '',             
            address: (data.get('address') as string) || '',           
            gstNumber: (data.get('gstNumber') as string) || '',         
        };

        const result = await updateSupplierInDb(id, supplierUpdate);

        if (result.success) {
            revalidatePath('/suppliers');
            revalidatePath('/purchases/create'); 
            revalidatePath('/customers');
            revalidatePath('/');
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

// --- Customer Actions ---
export async function addCustomer(data: FormData): Promise<{ success: boolean; id?: string; customer?: Customer; message?: string }> {
    try {
        const name = data.get('name') as string;
        if (!name || name.trim() === "") {
            return { success: false, message: 'Customer name cannot be empty.' };
        }

        const newCustomer: CustomerInput = {
          name: name.trim(),
          phoneNumber: (data.get('phoneNumber') as string) || '',
          email: (data.get('email') as string) || '',
          address: (data.get('address') as string) || '',
        };
        const result = await addCustomerToDb(newCustomer);

        if (result.success && result.id && result.customer) {
            revalidatePath('/customers'); 
            revalidatePath('/'); 
            return { success: true, message: 'Customer added successfully!', id: result.id, customer: result.customer};
        } else {
            return { success: false, message: result.message || 'Failed to add customer.' };
        }
    } catch (error: any) {
        console.error('Error adding customer:', error);
        return { success: false, message: error.message || 'An unexpected error occurred while adding customer.' };
    }
}

export async function updateCustomer(id: string, data: FormData): Promise<{ success: boolean; message?: string }> {
    try {
        const name = data.get('name') as string;
        if (!name || name.trim() === "") {
            return { success: false, message: 'Customer name cannot be empty.' };
        }

        const customerUpdate: Partial<CustomerInput> = {
            name: name.trim(),
            phoneNumber: (data.get('phoneNumber') as string) || '',
            email: (data.get('email') as string) || '',
            address: (data.get('address') as string) || '',
        };

        const result = await updateCustomerInDb(id, customerUpdate);

        if (result.success) {
            revalidatePath('/customers');
            revalidatePath('/');
            return { success: true, message: 'Customer updated successfully!' };
        } else {
            return { success: false, message: result.message || 'Failed to update customer.' };
        }
    } catch (error: any) {
        console.error('Error updating customer:', error);
        return { success: false, message: error.message || 'An unexpected error occurred while updating customer.' };
    }
}

export async function getCustomers(): Promise<Customer[]> {
    return getCustomersFromDb();
}

// --- Transaction Actions ---
export async function addTransaction(data: FormData) {
  try {
    const type = data.get('type') as 'income' | 'expense';
    const category = data.get('category') as string;
    const description = data.get('description') as string;
    const amountString = data.get('amount') as string;
    const transactionDateString = data.get('transactionDate') as string; 
    const notes = data.get('notes') as string | null;
    const tagsString = data.get('tags') as string | null;

    if (!type || !['income', 'expense'].includes(type)) {
      return { success: false, message: 'Invalid transaction type.' };
    }
    if (!category || category.trim() === "") {
      return { success: false, message: 'Category is required.' };
    }
    if (!description || description.trim() === "") {
      return { success: false, message: 'Description is required.' };
    }
    if (!amountString) {
      return { success: false, message: 'Amount is required.' };
    }
    if (!transactionDateString) {
      return { success: false, message: 'Transaction date is required.' };
    }

    const amount = parseFloat(amountString);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, message: 'Amount must be a positive number.' };
    }

    const userSelectedDate = new Date(transactionDateString); // Parses ISO string
    if (!isValid(userSelectedDate)) { // Use isValid from date-fns
        return { success: false, message: 'Invalid transaction date format.' };
    }
    
    const now = new Date();
    const combinedDateTime = new Date(
        userSelectedDate.getFullYear(),
        userSelectedDate.getMonth(),
        userSelectedDate.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds()
    );
    const transactionDate = Timestamp.fromDate(combinedDateTime);

    const tags = tagsString ? tagsString.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

    const newTransaction: TransactionInput = {
      type,
      category,
      description,
      amount,
      transactionDate,
      notes: notes || undefined,
      tags: tags,
    };

    const result = await addTransactionToDb(newTransaction);

    if (result.success) {
      revalidatePath('/transactions');
      return { success: true, message: `${type.charAt(0).toUpperCase() + type.slice(1)} added successfully!`, id: result.id };
    } else {
      return { success: false, message: result.message || `Failed to add ${type}.` };
    }
  } catch (error: any) {
    console.error(`Error adding ${data.get('type')}:`, error);
    return { success: false, message: error.message || 'An unexpected error occurred.' };
  }
}

export async function getTransactions(): Promise<Transaction[]> {
    return getTransactionsFromDb();
}
