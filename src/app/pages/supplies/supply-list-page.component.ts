import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { SupplyService } from '../../core/services/supply.service';

@Component({
  selector: 'app-supply-list-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './supply-list-page.component.html',
})
export class SupplyListPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly supplyService = inject(SupplyService);
  private readonly destroyRef = inject(DestroyRef);

  readonly title = signal(String(this.route.snapshot.data['title'] ?? 'Supplies'));
  readonly status = signal(String(this.route.snapshot.data['status'] ?? 'DRAFT'));
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly rows = signal<any[]>([]);
  readonly searchControl = this.fb.nonNullable.control('');

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(0);
        this.loadRows();
      });

    this.loadRows();
  }

  loadRows() {
    this.loading.set(true);
    this.error.set(false);
    this.supplyService
      .searchSupplyDocuments({
        q: this.searchControl.getRawValue(),
        status: this.status(),
        page: this.page(),
        size: 20,
        sort: 'documentDate,desc',
      })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.rows.set(response?.content ?? []);
          this.totalPages.set(response?.totalPages ?? 0);
        },
        error: (err) => {
          console.error(err);
          this.error.set(true);
          this.rows.set([]);
        },
      });
  }

  goTo(path: string) {
    void this.router.navigateByUrl(path);
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

  protected readonly Math = Math;
}
