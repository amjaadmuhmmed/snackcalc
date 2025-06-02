
// src/app/suppliers/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Edit, Loader2, PlusCircle, Search } from "lucide-react"; // Added Search
import { getSuppliers, updateSupplier, addSupplier } from "@/app/actions";
import type { Supplier, SupplierInput } from "@/lib/db";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const supplierSchema = z.object({
  name: z.string().min(1, { message: "Supplier name cannot be empty." }),
  contactPerson: z.string().optional(),
  phoneNumber: z.string().optional(),
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')),
  address: z.string().optional(),
  gstNumber: z.string().optional(),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

export default function SuppliersPage() {
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      contactPerson: "",
      phoneNumber: "",
      email: "",
      address: "",
      gstNumber: "",
    },
  });

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const fetchedSuppliers = await getSuppliers();
      setAllSuppliers(fetchedSuppliers);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch suppliers:", err);
      setError("Failed to load suppliers. Please try again later.");
      setAllSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleOpenDialog = (mode: 'add' | 'edit', supplier?: Supplier) => {
    setDialogMode(mode);
    if (mode === 'edit' && supplier) {
      setEditingSupplier(supplier);
      form.reset({
        name: supplier.name,
        contactPerson: supplier.contactPerson || "",
        phoneNumber: supplier.phoneNumber || "",
        email: supplier.email || "",
        address: supplier.address || "",
        gstNumber: supplier.gstNumber || "",
      });
    } else {
      setEditingSupplier(null);
      form.reset({ // Reset to defaults for 'add' mode
        name: "",
        contactPerson: "",
        phoneNumber: "",
        email: "",
        address: "",
        gstNumber: "",
      });
    }
  };

  const onSubmit = async (data: SupplierFormData) => {
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('contactPerson', data.contactPerson || '');
    formData.append('phoneNumber', data.phoneNumber || '');
    formData.append('email', data.email || '');
    formData.append('address', data.address || '');
    formData.append('gstNumber', data.gstNumber || '');

    try {
      let result;
      if (dialogMode === 'edit' && editingSupplier) {
        result = await updateSupplier(editingSupplier.id, formData);
      } else if (dialogMode === 'add') {
        const addResult = await addSupplier(formData);
        result = { success: addResult.success, message: addResult.message };
      } else {
        toast({ variant: "destructive", title: "Error", description: "Invalid dialog mode." });
        setIsSubmitting(false);
        return;
      }

      if (result.success) {
        toast({ title: "Success", description: result.message || (dialogMode === 'add' ? "Supplier added successfully!" : "Supplier updated successfully!") });
        setDialogMode(null);
        setEditingSupplier(null);
        fetchSuppliers(); 
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm) {
      return allSuppliers;
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allSuppliers.filter(supplier =>
      supplier.name.toLowerCase().includes(lowerSearchTerm) ||
      (supplier.contactPerson && supplier.contactPerson.toLowerCase().includes(lowerSearchTerm)) ||
      (supplier.phoneNumber && supplier.phoneNumber.toLowerCase().includes(lowerSearchTerm)) ||
      (supplier.email && supplier.email.toLowerCase().includes(lowerSearchTerm)) ||
      (supplier.gstNumber && supplier.gstNumber.toLowerCase().includes(lowerSearchTerm))
    );
  }, [allSuppliers, searchTerm]);

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-secondary p-4 md:p-8">
      <div className="w-full max-w-5xl mb-4 flex justify-between items-center">
        <Button variant="outline" size="icon" asChild>
          <Link href="/" aria-label="Back to Main Page">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Supplier List</h1>
        <Button variant="outline" onClick={() => handleOpenDialog('add')}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Supplier
        </Button>
      </div>

      <Card className="w-full max-w-5xl">
        <CardHeader>
          <CardTitle>All Suppliers</CardTitle>
          <CardDescription>Manage your suppliers. Search, edit, or add new suppliers.</CardDescription>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search suppliers by name, contact, phone, email, GSTIN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-full sm:w-1/2 md:w-1/3 h-9"
              aria-label="Search suppliers"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground">Loading suppliers...</p>
          ) : error ? (
            <p className="text-center text-destructive">{error}</p>
          ) : filteredSuppliers.length === 0 ? (
            <p className="text-center text-muted-foreground">
              {allSuppliers.length === 0 ? "No suppliers recorded yet. Click 'Add New Supplier' to get started." : "No suppliers match your search criteria."}
            </p>
          ) : (
            <Table>
              <TableCaption>Details of all registered suppliers.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[20%]">Supplier Name</TableHead>
                  <TableHead className="w-[15%]">Contact Person</TableHead>
                  <TableHead className="w-[15%]">Phone Number</TableHead>
                  <TableHead className="w-[15%]">Email</TableHead>
                  <TableHead className="w-[20%]">Address</TableHead>
                  <TableHead className="w-[10%]">GSTIN</TableHead>
                  <TableHead className="text-center w-[5%]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>{supplier.contactPerson || '-'}</TableCell>
                    <TableCell>{supplier.phoneNumber || '-'}</TableCell>
                    <TableCell>{supplier.email || '-'}</TableCell>
                    <TableCell className="whitespace-pre-wrap max-w-xs">{supplier.address || '-'}</TableCell>
                    <TableCell>{supplier.gstNumber || '-'}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="outline" size="sm" onClick={() => handleOpenDialog('edit', supplier)}>
                        <Edit className="h-4 w-4 mr-1 sm:mr-2" /> <span className="hidden sm:inline">Edit</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogMode !== null} onOpenChange={(open) => {
          if (!open) {
            setDialogMode(null);
            setEditingSupplier(null); 
            form.reset(); 
          }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'add' ? "Add New Supplier" : `Edit Supplier: ${editingSupplier?.name || ""}`}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'add' 
                ? "Enter the details for the new supplier." 
                : "Update the details for this supplier. Click save when you're done."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4 max-h-[75vh] overflow-y-auto pr-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Supplier's full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactPerson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number (Optional)</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="e.g., +919876543210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Optional)</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="e.g., contact@supplier.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Supplier's full address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gstNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GSTIN (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 29ABCDE1234F1Z5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="sticky bottom-0 bg-background py-4 border-t">
                <Button type="button" variant="outline" onClick={() => { setDialogMode(null); form.reset(); }}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {dialogMode === 'add' ? "Add Supplier" : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  );
}


    