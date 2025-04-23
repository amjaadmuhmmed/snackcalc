'use server';

import {db} from './firebase';
import {collection, addDoc, getDocs, updateDoc, deleteDoc, doc} from 'firebase/firestore';

interface Snack {
  id: string;
  name: string;
  category: string;
  price: number;
}

const snacksCollection = collection(db, 'snack');

export async function addSnackToDb(snack: Omit<Snack, 'id'>) {
  try {
    await addDoc(snacksCollection, snack);
    return {success: true};
  } catch (e: any) {
    console.error('Error adding document: ', e);
    return {success: false, error: e.message};
  }
}

export async function updateSnackInDb(id: string, snack: Omit<Snack, 'id'>) {
  try {
    const snackDoc = doc(db, 'snack', id);
    await updateDoc(snackDoc, snack);
    return {success: true};
  } catch (e: any) {
    console.error('Error updating document: ', e);
    return {success: false, error: e.message};
  }
}

export async function deleteSnackFromDb(id: string) {
  try {
    const snackDoc = doc(db, 'snack', id);
    await deleteDoc(snackDoc);
    return {success: true};
  } catch (e: any) {
    console.error('Error deleting document: ', e);
    return {success: false, error: e.message};
  }
}

export async function getSnacksFromDb(): Promise<Snack[]> {
  try {
    const snackSnapshot = await getDocs(snacksCollection);
    return snackSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Snack[];
  } catch (e: any) {
    console.error('Error getting documents: ', e);
    return [];
  }
}
