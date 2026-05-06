import { CommonModule } from '@angular/common';
import { Component, DestroyRef, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InventoryService } from '../../core/services/inventory.service';
import { UiAlertService } from '../../core/services/ui-alert.service';

@Component({
  selector: 'app-tecdoc-search-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tecdoc-search-dialog.component.html',
})
export class TecDocSearchDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly inventoryService = inject(InventoryService);
  private readonly alerts = inject(UiAlertService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() open = false;
  @Input() brands: any[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() selected = new EventEmitter<any>();

  readonly searching = signal(false);
  readonly results = signal<any[]>([]);
  readonly searched = signal(false);
  readonly form = this.fb.nonNullable.group({
    articleNumber: ['', Validators.required],
    brandId: [''],
  });

  submit() {
    if (this.form.invalid || this.searching()) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.searching.set(true);
    this.inventoryService
      .searchTecDocArticles({
        articleNumber: raw.articleNumber,
        brandId: raw.brandId ? Number(raw.brandId) : undefined,
      })
      .pipe(
        finalize(() => this.searching.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (results) => {
          this.results.set(results ?? []);
          this.searched.set(true);
        },
        error: (error) => {
          const status = error?.status;
          const message = error?.error?.message;
          if (status === 429) {
            this.alerts.error('TecDoc API monthly quota exceeded on the current RapidAPI plan.');
          } else {
            this.alerts.error(message || 'Failed to search TecDoc');
          }
        },
      });
  }
}
