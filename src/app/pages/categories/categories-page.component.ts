import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { LookupService } from '../../core/services/lookup.service';
import { UiAlertService } from '../../core/services/ui-alert.service';

@Component({
  selector: 'app-categories-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './categories-page.component.html',
})
export class CategoriesPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly lookupService = inject(LookupService);
  private readonly alerts = inject(UiAlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly categories = signal<any[]>([]);
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
  });

  constructor() {
    this.loadCategories();
  }

  loadCategories() {
    this.loading.set(true);
    this.lookupService
      .getCategories()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response: any) => {
        this.categories.set(response?.content ?? response ?? []);
      });
  }

  submit() {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.lookupService
      .createCategory({ name: this.form.getRawValue().name.trim() })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.form.reset({ name: '' });
          this.alerts.success('Category created successfully');
          this.loadCategories();
        },
        error: (error) => {
          console.error(error);
          this.alerts.error('Failed to create category');
        },
      });
  }
}
