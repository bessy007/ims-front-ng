import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { CustomersService } from '../../core/services/customers.service';
import { SalesService } from '../../core/services/sales.service';
import { UiAlertService } from '../../core/services/ui-alert.service';
import {
  autoFormatDateInput,
  dateTextToHtmlDate,
  formatDateTime,
  formatMoney,
  htmlDateToDisplayDate,
  isValidDisplayDate,
  parseDisplayDateToBackend,
} from '../../shared/utils/formatters';
import { SalesPaymentDialogComponent } from '../../shared/components/sales-payment-dialog.component';
import { SalesRowContextMenuComponent } from '../../shared/components/sales-row-context-menu.component';

@Component({
  selector: 'app-sales-list-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SalesPaymentDialogComponent, SalesRowContextMenuComponent],
  templateUrl: './sales-list-page.component.html',
})
export class SalesListPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly customersService = inject(CustomersService);
  private readonly salesService = inject(SalesService);
  private readonly alerts = inject(UiAlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly rows = signal<any[]>([]);
  readonly totalPages = signal(0);
  readonly page = signal(0);
  readonly customerOptions = signal<any[]>([]);
  readonly customersLoading = signal(false);
  readonly selectedCustomer = signal<any | null>(null);
  readonly showCustomerDropdown = signal(false);
  readonly paymentDialogOpen = signal(false);
  readonly selectedDocumentId = signal<number | null>(null);
  readonly selectedDocumentTotal = signal(0);
  readonly paymentPaidTotal = signal('0');
  readonly paymentSaving = signal(false);
  readonly contextMenu = signal({ open: false, x: 0, y: 0, row: null as any });

  readonly filtersForm = this.fb.nonNullable.group({
    q: [''],
    dateFrom: [''],
    dateTo: [''],
    paymentMethod: [''],
    paid: [''],
    customerSearch: [''],
  });

  constructor() {
    this.filtersForm.controls.customerSearch.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.onCustomerSearchChange(value));

    this.loadRows();
  }

  loadRows() {
    this.loading.set(true);
    this.error.set(false);

    const raw = this.filtersForm.getRawValue();
    this.salesService
      .searchSalesDocuments(
        {
          q: raw.q || undefined,
          dateFrom: parseDisplayDateToBackend(raw.dateFrom, false),
          dateTo: parseDisplayDateToBackend(raw.dateTo, true),
          customerId: this.selectedCustomer()?.id ?? undefined,
          paymentMethod: raw.paymentMethod || undefined,
          paid: raw.paid === '' ? undefined : raw.paid === 'true',
        },
        {
          page: this.page(),
          size: 20,
          sort: 'documentDate,desc',
        },
      )
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.rows.set(response?.content ?? []);
          this.totalPages.set(response?.totalPages ?? 0);
        },
        error: (error) => {
          console.error(error);
          this.error.set(true);
          this.rows.set([]);
        },
      });
  }

  onCustomerSearchChange(value: string) {
    this.page.set(0);
    this.selectedCustomer.set(null);

    if (!value.trim()) {
      this.customerOptions.set([]);
      this.showCustomerDropdown.set(false);
      return;
    }

    this.showCustomerDropdown.set(true);
    this.customersLoading.set(true);
    this.customersService
      .searchCustomers(value, 0, 10)
      .pipe(
        finalize(() => this.customersLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        this.customerOptions.set(response?.content ?? response ?? []);
      });
  }

  setFilterValue(field: 'q' | 'paymentMethod' | 'paid', value: string) {
    this.page.set(0);
    this.filtersForm.controls[field].setValue(value);
  }

  setDateText(field: 'dateFrom' | 'dateTo', value: string) {
    this.page.set(0);
    this.filtersForm.controls[field].setValue(autoFormatDateInput(value));
  }

  setDateCalendar(field: 'dateFrom' | 'dateTo', value: string) {
    this.page.set(0);
    this.filtersForm.controls[field].setValue(htmlDateToDisplayDate(value));
  }

  selectCustomer(customer: any) {
    this.page.set(0);
    this.selectedCustomer.set(customer);
    this.filtersForm.controls.customerSearch.setValue(customer.name, { emitEvent: false });
    this.showCustomerDropdown.set(false);
  }

  clearCustomer() {
    this.page.set(0);
    this.selectedCustomer.set(null);
    this.filtersForm.controls.customerSearch.setValue('', { emitEvent: false });
    this.showCustomerDropdown.set(false);
    this.customerOptions.set([]);
  }

  openDocument(row: any) {
    void this.router.navigate(['/sales', row.id]);
  }

  openContextMenu(event: MouseEvent, row: any) {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.set({ open: true, x: event.clientX, y: event.clientY, row });
  }

  closeContextMenu() {
    this.contextMenu.set({ open: false, x: 0, y: 0, row: null });
  }

  printDocument(row: any) {
    this.alerts.success(`Print Document: ${row.documentNumber}`);
  }

  deleteDocument(row: any) {
    if (!this.alerts.confirm(`Are you sure you want to delete document ${row.documentNumber}?`)) {
      return;
    }

    this.salesService
      .deleteSalesDocument(row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loadRows(),
        error: (error) => {
          console.error(error);
          this.alerts.error(error?.error?.message ?? error?.error ?? 'Failed to delete document');
        },
      });
  }

  openPaymentDialog(row: any) {
    this.selectedDocumentId.set(Number(row.id));
    this.selectedDocumentTotal.set(Number(row.totalAmount ?? 0));
    this.paymentPaidTotal.set(String(Number(row.paidTotal ?? 0).toFixed(2)));
    this.paymentDialogOpen.set(true);
  }

  confirmPayment() {
    if (!this.selectedDocumentId()) return;

    this.paymentSaving.set(true);
    this.salesService
      .updatePayment(this.selectedDocumentId()!, Number(this.paymentPaidTotal()))
      .pipe(
        finalize(() => this.paymentSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.paymentDialogOpen.set(false);
          this.selectedDocumentId.set(null);
          this.selectedDocumentTotal.set(0);
          this.paymentPaidTotal.set('0');
          this.loadRows();
        },
        error: (error) => {
          console.error(error);
          this.alerts.error(error?.error?.message ?? error?.error ?? 'Failed to update payment');
        },
      });
  }

  fiscalize(row: any) {
    if (row.fiscalized) {
      this.alerts.error('This document is already fiscalized.');
      return;
    }

    if (!this.alerts.confirm(`Are you sure you want to fiscalize document ${row.documentNumber}?`)) {
      return;
    }

    this.salesService
      .fiscalizeSalesDocument(row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loadRows(),
        error: (error) => {
          console.error(error);
          this.alerts.error(error?.error?.message ?? error?.error ?? 'Failed to fiscalize document');
        },
      });
  }

  previousPage() {
    if (this.page() <= 0) return;
    this.page.update((value) => value - 1);
    this.loadRows();
  }

  nextPage() {
    if (this.page() + 1 >= this.totalPages()) return;
    this.page.update((value) => value + 1);
    this.loadRows();
  }

  readonly formatDate = formatDateTime;
  readonly formatMoney = formatMoney;
  readonly isValidDateFormat = isValidDisplayDate;
  readonly dateTextToHtmlDate = dateTextToHtmlDate;
  readonly Math = Math;

  getRemainingAmount(row: any) {
    return Number(row.totalAmount ?? 0) - Number(row.paidTotal ?? 0);
  }

  setPaymentFull() {
    this.paymentPaidTotal.set(String(this.selectedDocumentTotal().toFixed(2)));
  }
}
