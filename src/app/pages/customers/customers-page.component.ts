import { Component, DestroyRef, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { CustomersService } from '../../core/services/customers.service';
import { UiAlertService } from '../../core/services/ui-alert.service';

@Component({
  selector: 'app-customers-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './customers-page.component.html',
})
export class CustomersPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly customersService = inject(CustomersService);
  private readonly alerts = inject(UiAlertService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('formAnchor') private formAnchor?: ElementRef<HTMLElement>;

  readonly loading = signal(true);
  readonly fetching = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly searchControl = this.fb.nonNullable.control('');
  readonly customers = signal<any[]>([]);
  readonly totalCount = signal(0);
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    phone: [''],
    email: [''],
    address: [''],
    vatNumber: [''],
  });
  readonly isEditing = computed(() => this.editingId() !== null);

  constructor() {
    this.loadCustomers('');

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.loadCustomers(value, true));
  }

  loadCustomers(query: string, searching = false) {
    if (searching) {
      this.fetching.set(true);
    } else {
      this.loading.set(true);
    }

    this.customersService
      .searchCustomers(query.trim(), 0, 50)
      .pipe(
        finalize(() => {
          this.loading.set(false);
          this.fetching.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          const rows = Array.isArray(response?.content) ? response.content : [];
          this.customers.set(rows);
          this.totalCount.set(response?.totalElements ?? rows.length);
        },
        error: (error) => {
          console.error(error);
          this.customers.set([]);
        },
      });
  }

  clearForm() {
    this.editingId.set(null);
    this.form.reset({
      name: '',
      phone: '',
      email: '',
      address: '',
      vatNumber: '',
    });
  }

  scrollToForm() {
    this.clearForm();
    this.formAnchor?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  editCustomer(customer: any) {
    this.editingId.set(Number(customer.id));
    this.form.reset({
      name: customer.name ?? '',
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      address: customer.address ?? '',
      vatNumber: customer.vatNumber ?? '',
    });
    this.formAnchor?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  deleteCustomer(customer: any) {
    if (!this.alerts.confirm(`Are you sure you want to delete "${customer.name}"?`)) {
      return;
    }

    this.deleting.set(true);
    this.customersService
      .deleteCustomer(Number(customer.id))
      .pipe(
        finalize(() => this.deleting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.clearForm();
          this.alerts.success('Customer deleted successfully');
          this.loadCustomers(this.searchControl.getRawValue(), true);
        },
        error: (error) => {
          console.error(error);
          this.alerts.error(
            error?.error?.message ??
              'Failed to delete customer. Customer may already be used in sales.',
          );
        },
      });
  }

  submit() {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const rawValue = this.form.getRawValue();
    const payload = {
      name: rawValue.name.trim(),
      phone: rawValue.phone.trim(),
      email: rawValue.email.trim(),
      address: rawValue.address.trim(),
      vatNumber: rawValue.vatNumber.trim(),
    };

    this.saving.set(true);
    const request$ = this.editingId()
      ? this.customersService.updateCustomer(this.editingId()!, payload)
      : this.customersService.createCustomer(payload);

    request$
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          const message = this.isEditing()
            ? 'Customer updated successfully'
            : 'Customer created successfully';
          this.clearForm();
          this.alerts.success(message);
          this.loadCustomers(this.searchControl.getRawValue(), true);
        },
        error: (error) => {
          console.error(error);
          this.alerts.error(
            error?.error?.message ??
              (this.isEditing() ? 'Failed to update customer' : 'Failed to create customer'),
          );
        },
      });
  }
}
