import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { LookupService } from '../../core/services/lookup.service';
import { UiAlertService } from '../../core/services/ui-alert.service';

@Component({
  selector: 'app-brands-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './brands-page.component.html',
})
export class BrandsPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly lookupService = inject(LookupService);
  private readonly alerts = inject(UiAlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly brands = signal<any[]>([]);
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    tecdocSupplierId: [''],
  });

  constructor() {
    this.loadBrands();
  }

  loadBrands() {
    this.loading.set(true);
    this.lookupService
      .getBrands()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response: any) => {
        this.brands.set(response?.content ?? response ?? []);
      });
  }

  submit() {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saving.set(true);
    this.lookupService
      .createBrand({
        name: value.name.trim(),
        tecdocSupplierId: value.tecdocSupplierId ? Number(value.tecdocSupplierId) : null,
      })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.form.reset({ name: '', tecdocSupplierId: '' });
          this.alerts.success('Brand created successfully');
          this.loadBrands();
        },
        error: (error) => {
          console.error(error);
          this.alerts.error('Failed to create brand');
        },
      });
  }
}
