import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-product-create-redirect',
  standalone: true,
  template: '',
})
export class ProductCreateRedirectComponent {
  private readonly router = inject(Router);

  constructor() {
    void this.router.navigate(['/products'], {
      queryParams: { new: '1' },
      replaceUrl: true,
    });
  }
}
