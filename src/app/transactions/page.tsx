// src/app/transactions/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { getTransactions, updateTransaction, deleteTransaction } from "../actions"; // Import the server action
import type { Transaction } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Calendar as CalendarIcon, XCircle, Search as SearchIcon, Edit, Loader2, PiggyBank, X, Tag, Trash2 } from "lucide-react";
import { format, isValid, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
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
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";

const currencySymbol = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '₹';

// This helper is now more robust to handle different timestamp representations from Firebase.
const convertFirestoreTimestampToDate = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  try {
    // Already a JS Date object
    if (timestamp instanceof Date) {
      return isValid(timestamp) ? timestamp : null;
    }
    // Firebase client SDK Timestamp object
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      const d = timestamp.toDate();
      return isValid(d) ? d : null;
    }
    // Serialized timestamp from server actions (often happens with Next.js)
    if (typeof timestamp === 'object' && timestamp !== null && typeof timestamp.seconds === 'number') {
      const d = new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
      return isValid(d) ? d : null;
    }
    // Fallback for Unix milliseconds or ISO string
    const d = new Date(timestamp);
    return isValid(d) ? d : null;
  } catch (e) {
    console.error("Error converting timestamp to Date:", e, "Timestamp value:", timestamp);
    return null;
  }
};


const transactionSchema = z.object({
  transactionDate: z.date({ required_error: "Transaction date is required." }),
  category: z.string().min(1, "Category is required."),
  amount: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Amount must be a positive number."),
  source: z.string().min(1, "Source is required."),
  notes: z.string().optional(),
  tags: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

export default function TransactionsPage() {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  const [textSearchTerm, setTextSearchTerm] = useState<string>("");
  const [tagSearchTerm, setTagSearchTerm] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
  });

  const fetchTransactions = async () => {
      try {
        setLoading(true);
        const fetchedTransactions = await getTransactions();
        setAllTransactions(fetchedTransactions);
        setError(null);
      } catch (err: any) {
        console.error("Failed to fetch transactions:", err);
        setError("Failed to load transactions. Please try again later.");
        setAllTransactions([]);
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    if (loading) return;

    let tempFiltered = [...allTransactions];

    // Date Range Filter
    if (dateRange?.from) {
      const fromDate = startOfDay(dateRange.from);
      const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);

      tempFiltered = tempFiltered.filter((transaction) => {
        const transactionDate = convertFirestoreTimestampToDate(transaction.transactionDate);
        if (!transactionDate || !isValid(transactionDate)) {
          console.warn(`Transaction ${transaction.id} has invalid transactionDate:`, transaction.transactionDate);
          return false;
        }
        return isWithinInterval(transactionDate, {
          start: fromDate <= toDate ? fromDate : toDate,
          end: fromDate <= toDate ? toDate : fromDate
        });
      });
    }

    // Selected Tags Filter (AND logic)
    if (selectedTags.length > 0) {
        tempFiltered = tempFiltered.filter(transaction => {
            const transactionTags = (transaction.tags || []).map(t => t.toLowerCase());
            return selectedTags.every(filterTag => transactionTags.includes(filterTag.toLowerCase()));
        });
    }


    // Text Search Term Filter
    if (textSearchTerm.trim() !== "") {
        const lowerSearchTerm = textSearchTerm.toLowerCase();
        tempFiltered = tempFiltered.filter(transaction =>
            (transaction.category && transaction.category.toLowerCase().includes(lowerSearchTerm)) ||
            (transaction.source && transaction.source.toLowerCase().includes(lowerSearchTerm)) ||
            (transaction.notes && transaction.notes.toLowerCase().includes(lowerSearchTerm))
        );
    }

    setFilteredTransactions(tempFiltered);

  }, [allTransactions, dateRange, textSearchTerm, selectedTags, loading]);

  const handleTagSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && tagSearchTerm.trim() !== "") {
        event.preventDefault();
        const newTag = tagSearchTerm.trim();
        if (!selectedTags.map(t => t.toLowerCase()).includes(newTag.toLowerCase())) {
            setSelectedTags(prev => [...prev, newTag]);
        }
        setTagSearchTerm("");
    }
  };

  const removeTag = (tagToRemove: string) => {
      setSelectedTags(prev => prev.filter(tag => tag.toLowerCase() !== tagToRemove.toLowerCase()));
  };

  const handleEditClick = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    const transactionDate = convertFirestoreTimestampToDate(transaction.transactionDate);
    form.reset({
        transactionDate: transactionDate || new Date(),
        category: transaction.category,
        amount: transaction.amount.toString(),
        source: transaction.source || "",
        notes: transaction.notes || "",
        tags: transaction.tags?.join(", ") || "",
    });
  };
  
  const handleDeleteTransaction = async (id: string) => {
    const result = await deleteTransaction(id);
    if (result.success) {
      toast({ title: result.message });
      fetchTransactions();
    } else {
      toast({ variant: "destructive", title: "Error", description: result.message });
    }
  };

  const onSubmit = async (data: TransactionFormData) => {
    if (!editingTransaction) return;

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('type', editingTransaction.type); // Needed for toast message in action
    formData.append('category', data.category);
    formData.append('amount', data.amount);
    formData.append('source', data.source);
    formData.append('transactionDate', data.transactionDate.toISOString());
    if (data.notes) formData.append('notes', data.notes);
    if (data.tags) formData.append('tags', data.tags);
    
    try {
        const result = await updateTransaction(editingTransaction.id, formData);
        if (result.success) {
            toast({ title: "Success", description: result.message });
            setEditingTransaction(null);
            fetchTransactions(); // Re-fetch to get the latest data
        } else {
            toast({ variant: "destructive", title: "Error", description: result.message });
        }
    } catch (error: any) {
        toast({ variant: "destructive", title: "An unexpected error occurred.", description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  };


  const formatFirestoreTimestampForDisplay = (timestamp: any): string => {
    const date = convertFirestoreTimestampToDate(timestamp);
    if (date && isValid(date)) {
      return format(date, 'Pp');
    }
    return 'Invalid Date';
  };
  
  const summaryTotals = useMemo(() => {
    return filteredTransactions.reduce((acc, transaction) => {
      if (transaction.type === 'income') {
        acc.totalIncome += transaction.amount;
      } else if (transaction.type === 'expense') {
        acc.totalExpense += transaction.amount;
      }
      return acc;
    }, { totalIncome: 0, totalExpense: 0 });
  }, [filteredTransactions]);

  const netTotal = summaryTotals.totalIncome - summaryTotals.totalExpense;

  const getCardDescription = () => {
    let description = "";
    if (dateRange?.from && !dateRange.to) {
      description = `Showing transactions for ${format(dateRange.from, "LLL dd, yyyy")}`;
    } else if (dateRange?.from && dateRange?.to && format(dateRange.from, "yyyy-MM-dd") === format(dateRange.to, "yyyy-MM-dd")) {
      description = `Showing transactions for ${format(dateRange.from, "LLL dd, yyyy")}`;
    } else if (dateRange?.from && dateRange?.to) {
      description = `Showing transactions from ${format(dateRange.from, "LLL dd, yyyy")} to ${format(dateRange.to, "LLL dd, yyyy")}`;
    } else {
      description = "Showing all transactions";
    }

    if (textSearchTerm) {
      description += ` matching "${textSearchTerm}"`;
    }
    if (selectedTags.length > 0) {
        description += ` tagged with: ${selectedTags.join(', ')}`;
    }
    description += ".";
    return description;
  };


  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-secondary p-4 md:p-8">
       <div className="w-full max-w-5xl mb-4 flex justify-between items-center">
             <Button variant="outline" size="icon" asChild>
                <Link href="/" aria-label="Back to Admin Panel">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
            </Button>
            <h1 className="text-2xl font-semibold">Income & Expense History</h1>
            <div style={{ width: '36px' }}></div> {/* Spacer */}
        </div>

      <Card className="w-full max-w-5xl">
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <CardDescription>
                    {getCardDescription()}
                </CardDescription>
                <div className="flex flex-wrap gap-2 items-center">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="date"
                          variant={"outline"}
                          className={cn(
                            "w-full sm:w-[260px] justify-start text-left font-normal h-9",
                            !dateRange && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange?.from ? (
                            dateRange.to ? (
                              <>
                                {format(dateRange.from, "LLL dd, y")} -{" "}
                                {format(dateRange.to, "LLL dd, y")}
                              </>
                            ) : (
                              format(dateRange.from, "LLL dd, y")
                            )
                          ) : (
                            <span>Pick a date range</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={dateRange?.from}
                          selected={dateRange}
                          onSelect={setDateRange}
                          numberOfMonths={2}
                        />
                      </PopoverContent>
                    </Popover>
                    {dateRange && (
                        <Button variant="ghost" size="icon" onClick={() => setDateRange(undefined)} aria-label="Clear date filter" className="h-9 w-9">
                            <XCircle className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="relative">
                        <Label htmlFor="text-search" className="sr-only">Search Text</Label>
                        <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="text-search"
                            type="search"
                            placeholder="Search category, source, notes..."
                            value={textSearchTerm}
                            onChange={(e) => setTextSearchTerm(e.target.value)}
                            className="pl-8 w-full h-9"
                            aria-label="Search transactions by text"
                        />
                    </div>
                     <div className="relative">
                        <Label htmlFor="tag-search" className="sr-only">Add Tag Filter</Label>
                        <Tag className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="tag-search"
                            type="search"
                            placeholder="Add tag filter and press Enter..."
                            value={tagSearchTerm}
                            onChange={(e) => setTagSearchTerm(e.target.value)}
                            onKeyDown={handleTagSearchKeyDown}
                            className="pl-8 w-full h-9"
                            aria-label="Add tag filter"
                        />
                    </div>
                </div>
                {selectedTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-sm text-muted-foreground">Filtering by tags:</span>
                        {selectedTags.map(tag => (
                            <Badge key={tag} variant="secondary" className="pl-2 pr-1 py-0.5 text-sm">
                                {tag}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="ml-1 h-4 w-4 rounded-full"
                                    onClick={() => removeTag(tag)}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </Badge>
                        ))}
                         <Button
                            variant="link"
                            size="sm"
                            className="text-xs text-muted-foreground h-auto p-0"
                            onClick={() => setSelectedTags([])}
                         >
                            Clear All
                         </Button>
                    </div>
                )}
            </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground">Loading transactions...</p>
          ) : error ? (
            <p className="text-center text-destructive">{error}</p>
          ) : filteredTransactions.length === 0 ? (
             <p className="text-center text-muted-foreground">
                {allTransactions.length === 0 ? "No income or expense transactions recorded yet." : "No transactions found for the current filter criteria."}
            </p>
          ) : (
            <Table>
               <TableCaption>A list of your recent income and expense transactions.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="min-w-[300px]">Notes</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{transaction.category}</TableCell>
                    <TableCell>{transaction.source || '-'}</TableCell>
                    <TableCell className={`text-right font-semibold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {transaction.type === 'income' ? '+' : '-'}{currencySymbol}{transaction.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatFirestoreTimestampForDisplay(transaction.transactionDate)}</TableCell>
                    <TableCell>
                        {transaction.tags && transaction.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                                {transaction.tags.map((tag, index) => (
                                    <Badge key={index} variant="outline">{tag}</Badge>
                                ))}
                            </div>
                        ) : (
                            '-'
                        )}
                    </TableCell>
                    <TableCell className="text-xs whitespace-pre-wrap max-w-xs min-w-[300px]">{transaction.notes || '-'}</TableCell>
                    <TableCell>
                        <Badge variant={transaction.type === 'income' ? 'default' : 'destructive'}>
                            {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-center space-x-1">
                      <Button variant="outline" size="sm" onClick={() => handleEditClick(transaction)}>
                        <Edit className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                           <Button variant="outline" size="sm">
                             <Trash2 className="h-3 w-3 mr-1" /> Delete
                           </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Confirm Deletion</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to delete this transaction?
                              <br />
                              <strong className="mt-2 block">{transaction.category}: {currencySymbol}{transaction.amount.toFixed(2)}</strong>
                              This action cannot be undone.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <DialogClose asChild>
                              <Button variant="destructive" onClick={() => handleDeleteTransaction(transaction.id)}>
                                Delete Transaction
                              </Button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {filteredTransactions.length > 0 && (
            <CardFooter className="flex flex-col sm:flex-row justify-end items-end sm:items-center gap-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-green-600">Total Income:</span>
                    <Badge variant="secondary" className="text-base font-semibold text-green-600">
                        {currencySymbol}{summaryTotals.totalIncome.toFixed(2)}
                    </Badge>
                </div>
                 <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-red-600">Total Expense:</span>
                    <Badge variant="secondary" className="text-base font-semibold text-red-600">
                        {currencySymbol}{summaryTotals.totalExpense.toFixed(2)}
                    </Badge>
                </div>
                 <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Net Total:</span>
                    <Badge variant="outline" className={`text-base font-semibold ${netTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {netTotal < 0 ? '-' : ''}{currencySymbol}{Math.abs(netTotal).toFixed(2)}
                    </Badge>
                </div>
            </CardFooter>
        )}
      </Card>

      <Dialog open={editingTransaction !== null} onOpenChange={(open) => !open && setEditingTransaction(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {editingTransaction?.type === 'income' ? 'Income' : 'Expense'}</DialogTitle>
            <DialogDescription>
              Update the details for this transaction. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[75vh] overflow-y-auto pr-2">
              <FormField
                control={form.control}
                name="transactionDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Transaction Date</FormLabel>
                    <DatePicker date={field.value} setDate={field.onChange} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Rent, Utilities, Salary" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount ({currencySymbol})</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="0.00" {...field} inputMode="decimal" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <div className="relative">
                        <PiggyBank className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                            <Input placeholder="e.g., Cash, Bank, Credit" {...field} className="pl-8"/>
                        </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Detailed notes about the transaction" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., office, monthly, utilities" {...field} />
                    </FormControl>
                    <FormDescription>
                      Comma-separated tags for easy filtering.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="sticky bottom-0 bg-background py-4 border-t">
                <Button type="button" variant="outline" onClick={() => setEditingTransaction(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
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
