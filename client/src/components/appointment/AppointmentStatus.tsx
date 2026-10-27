import { useState } from "react";
import { useForm } from "react-hook-form";
import { Appointment, InsertAppointment } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format";

// Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface AppointmentStatusProps {
  appointmentId: number;
  appointment: Appointment;
  action: "Reschedule" | "Complete" | "Cancel";
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Reschedule Form Component
function RescheduleForm({ 
  appointmentId, 
  appointment,
  onClose,
  onSuccess 
}: Omit<AppointmentStatusProps, 'action' | 'isOpen'>) {
  const { toast } = useToast();
  
  // Form definition
  const form = useForm({
    defaultValues: {
      dispositionStatus: "Reschedule" as const,
      updatedStartDate: appointment.startDate || "",
      updatedStartTime: appointment.startTime || "",
      updatedEndDate: appointment.endDate || "",
      updatedEndTime: appointment.endTime || "",
    }
  });
  
  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<InsertAppointment>) => {
      return apiRequest(
        "PATCH",
        `/api/appointments/${appointmentId}`,
        data
      );
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Appointment rescheduled successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: [`/api/appointments/${appointmentId}`] });
      if (appointment.clientId) {
        queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
        queryClient.invalidateQueries({ queryKey: [`/api/clients/${appointment.clientId}/appointments`] });
        queryClient.invalidateQueries({ queryKey: [`/api/clients/${appointment.clientId}/analytics`] });
      }
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to reschedule appointment: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Submit handler
  function onSubmit(data: any) {
    if (!data.updatedStartDate || !data.updatedStartTime) {
      toast({
        title: "Validation Error",
        description: "Updated start date and time are required",
        variant: "destructive",
      });
      return;
    }
    
    updateMutation.mutate(data);
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="updatedStartDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-medium required">Updated Start Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="updatedStartTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-medium required">Updated Start Time</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="updatedEndDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-medium">Updated End Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="updatedEndTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-medium">Updated End Time</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// Complete Form Component
function CompleteForm({ 
  appointmentId, 
  appointment,
  onClose,
  onSuccess 
}: Omit<AppointmentStatusProps, 'action' | 'isOpen'>) {
  const { toast } = useToast();
  
  // Form definition
  const form = useForm({
    defaultValues: {
      dispositionStatus: "Complete" as const,
      cashCollections: 0,
      electronicCollections: 0,
      seeClientAgain: true,
      paymentProcessor: "",
      paymentNotes: "",
      appointmentNotes: "",
    }
  });
  
  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<InsertAppointment>) => {
      return apiRequest(
        "PATCH",
        `/api/appointments/${appointmentId}`,
        data
      );
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Appointment completed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: [`/api/appointments/${appointmentId}`] });
      if (appointment.clientId) {
        queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
        queryClient.invalidateQueries({ queryKey: [`/api/clients/${appointment.clientId}/appointments`] });
        queryClient.invalidateQueries({ queryKey: [`/api/clients/${appointment.clientId}/analytics`] });
      }
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to complete appointment: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Submit handler
  function onSubmit(data: any) {
    const cashAmount = parseFloat(data.cashCollections) || 0;
    const digitalAmount = parseFloat(data.electronicCollections) || 0;
    
    if (cashAmount <= 0 && digitalAmount <= 0) {
      toast({
        title: "Validation Error",
        description: "Either cash or digital payment must be provided",
        variant: "destructive",
      });
      return;
    }
    
    // Prepare data with proper number types
    // Server recomputes totalClientCollections (deposit + cash + digital) via computeAppointmentFinancials
    const submissionData = {
      ...data,
      cashCollections: cashAmount,
      electronicCollections: digitalAmount,
    };
    
    updateMutation.mutate(submissionData);
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="cashCollections"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-medium">Cash Collected</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="electronicCollections"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-medium">Digital Collected</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="paymentProcessor"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-medium">Payment Processor</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment processor" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Venmo">Venmo</SelectItem>
                  <SelectItem value="Cash App">Cash App</SelectItem>
                  <SelectItem value="Apple Pay">Apple Pay</SelectItem>
                  <SelectItem value="BTC">BTC</SelectItem>
                  <SelectItem value="ETH">ETH</SelectItem>
                  <SelectItem value="Stripe">Stripe</SelectItem>
                  <SelectItem value="Square">Square</SelectItem>
                  <SelectItem value="Bank Wire">Bank Wire</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="seeClientAgain"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-medium">Would you see this client again?</FormLabel>
              <Select 
                onValueChange={(val) => field.onChange(val === "true")} 
                defaultValue={field.value ? "true" : "false"}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="appointmentNotes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-medium">Appointment Notes</FormLabel>
              <FormControl>
                <Textarea 
                  rows={3} 
                  placeholder="Enter any additional notes about this appointment" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="paymentNotes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-medium">Payment Notes</FormLabel>
              <FormControl>
                <Textarea 
                  rows={2} 
                  placeholder="Enter any payment-related notes" 
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// Cancel Form Component
function CancelForm({ 
  appointmentId, 
  appointment,
  onClose,
  onSuccess 
}: Omit<AppointmentStatusProps, 'action' | 'isOpen'>) {
  const { toast } = useToast();
  
  // Form definition
  const form = useForm({
    defaultValues: {
      dispositionStatus: "Cancel" as const,
      whoCanceled: "",
      depositRefundedToClient: 0,
      expenseReimbursementToClient: 0,
      cancellationDetails: "",
    }
  });
  
  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<InsertAppointment>) => {
      return apiRequest(
        "PATCH",
        `/api/appointments/${appointmentId}`,
        data
      );
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Appointment cancelled successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: [`/api/appointments/${appointmentId}`] });
      if (appointment.clientId) {
        queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
        queryClient.invalidateQueries({ queryKey: [`/api/clients/${appointment.clientId}/appointments`] });
        queryClient.invalidateQueries({ queryKey: [`/api/clients/${appointment.clientId}/analytics`] });
      }
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to cancel appointment: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Submit handler
  function onSubmit(data: any) {
    if (!data.whoCanceled) {
      toast({
        title: "Validation Error",
        description: "Please select who canceled the appointment",
        variant: "destructive",
      });
      return;
    }
    
    updateMutation.mutate(data);
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="whoCanceled"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-medium required">Who Canceled</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select who canceled" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="provider">Provider</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="depositRefundedToClient"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-medium">Amount of Deposit to Return</FormLabel>
              <FormDescription>
                Original deposit amount: {formatCurrency(appointment.clientDeposit || 0)}
              </FormDescription>
              <FormControl>
                <Input 
                  type="number" 
                  step="0.01"
                  min="0"
                  max={appointment.clientDeposit || 0}
                  placeholder="0.00"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="expenseReimbursementToClient"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-medium">Travel/Hosting Reimbursement</FormLabel>
              <FormDescription>
                Amount returned to client for prepaid travel or hosting expenses (airfare, venue, etc.)
              </FormDescription>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="cancellationDetails"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-medium">Cancellation Details</FormLabel>
              <FormControl>
                <Textarea 
                  rows={4} 
                  placeholder="Enter any details about the cancellation" 
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// Main component that selects the appropriate form to render
export default function AppointmentStatus({
  appointmentId,
  appointment,
  action,
  isOpen,
  onClose,
  onSuccess,
}: AppointmentStatusProps) {
  // Get title and description based on action
  const getDialogInfo = () => {
    switch (action) {
      case "Reschedule":
        return {
          title: "Reschedule Appointment",
          description: "Update the appointment date and time",
        };
      case "Complete":
        return {
          title: "Complete Appointment",
          description: "Enter payment and completion details",
        };
      case "Cancel":
        return {
          title: "Cancel Appointment",
          description: "Provide cancellation information",
        };
    }
  };
  
  const dialogInfo = getDialogInfo();
  
  // Render the appropriate form based on the action
  const renderForm = () => {
    switch (action) {
      case "Reschedule":
        return (
          <RescheduleForm 
            appointmentId={appointmentId} 
            appointment={appointment}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        );
      case "Complete":
        return (
          <CompleteForm 
            appointmentId={appointmentId} 
            appointment={appointment}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        );
      case "Cancel":
        return (
          <CancelForm 
            appointmentId={appointmentId} 
            appointment={appointment}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        );
      default:
        return null;
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogInfo.title}</DialogTitle>
          <DialogDescription>{dialogInfo.description}</DialogDescription>
        </DialogHeader>
        
        {renderForm()}
      </DialogContent>
    </Dialog>
  );
}