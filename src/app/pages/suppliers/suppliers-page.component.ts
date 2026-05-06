import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { LookupService } from '../../core/services/lookup.service';
import { UiAlertService } from '../../core/services/ui-alert.service';

@Component({
  selector: 'app-suppliers-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './suppliers-page.component.html',
})
export class SuppliersPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly lookupService = inject(LookupService);
  private readonly alerts = inject(UiAlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly suppliers = signal<any[]>([]);
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    contactPerson: [''],
    phone: [''],
    email: [''],
    address: [''],
    active: [true],
  });

  constructor() {
    this.loadSuppliers();
  }

  loadSuppliers() {
    this.loading.set(true);
    this.lookupService
      .getSuppliers()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response: any) => {
        this.suppliers.set(response?.content ?? response ?? []);
      });
  }

  submit() {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.lookupService
      .createSupplier(this.form.getRawValue())
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.form.reset({
            name: '',
            contactPerson: '',
            phone: '',
            email: '',
            address: '',
            active: true,
          });
          this.alerts.success('Supplier created successfully');
          this.loadSuppliers();
        },
        error: (error) => {
          console.error(error);
          this.alerts.error('Failed to create supplier');
        },
      });
  }
}
