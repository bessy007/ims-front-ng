import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-product-edit-redirect',
  standalone: true,
  template: '',
})
export class ProductEditRedirectComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    void this.router.navigate(['/products'], {
      queryParams: id ? { edit: id } : {},
      replaceUrl: true,
    });
  }
}
