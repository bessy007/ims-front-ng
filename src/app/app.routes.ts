import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { AppLayoutComponent } from './layout/app-layout.component';
import { LoginPageComponent } from './pages/auth/login-page.component';
import { BrandsPageComponent } from './pages/brands/brands-page.component';
import { CategoriesPageComponent } from './pages/categories/categories-page.component';
import { CustomersPageComponent } from './pages/customers/customers-page.component';
import { ProductDetailsPageComponent } from './pages/products/product-details-page.component';
import { ProductCreateRedirectComponent } from './pages/products/product-create-redirect.component';
import { ProductEditRedirectComponent } from './pages/products/product-edit-redirect.component';
import { ProductsPageComponent } from './pages/products/products-page.component';
import { SalesPageComponent } from './pages/sales/sales-page.component';
import { SalesDocumentDetailsPageComponent } from './pages/sales/sales-document-details-page.component';
import { SalesListPageComponent } from './pages/sales/sales-list-page.component';
import { SuppliersPageComponent } from './pages/suppliers/suppliers-page.component';
import { SupplyListPageComponent } from './pages/supplies/supply-list-page.component';
import { SupplyEditorPageComponent } from './pages/supplies/supply-editor-page.component';
import { StatisticsPageComponent } from './pages/statistics/statistics-page.component';
import { TransfersPageComponent } from './pages/transfers/transfers-page.component';

export const appRoutes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    component: LoginPageComponent,
  },
  {
    path: '',
    canActivate: [authGuard],
    component: AppLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'sales' },
      { path: 'sales', component: SalesPageComponent },
      { path: 'sales/list', component: SalesListPageComponent },
      { path: 'sales/:id', component: SalesDocumentDetailsPageComponent },
      { path: 'products', component: ProductsPageComponent },
      { path: 'products/new', component: ProductCreateRedirectComponent },
      { path: 'products/:id', component: ProductDetailsPageComponent },
      { path: 'products/:id/edit', component: ProductEditRedirectComponent },
      { path: 'customers', component: CustomersPageComponent },
      {
        path: 'supplies',
        component: SupplyListPageComponent,
        data: { title: 'Draft Supplies', status: 'DRAFT' },
      },
      {
        path: 'supplies/confirmed',
        component: SupplyListPageComponent,
        data: { title: 'Confirmed Supplies', status: 'CONFIRMED' },
      },
      { path: 'supplies/new', component: SupplyEditorPageComponent },
      { path: 'supplies/:id', component: SupplyEditorPageComponent },
      { path: 'transfers', component: TransfersPageComponent },
      { path: 'brands', component: BrandsPageComponent },
      { path: 'categories', component: CategoriesPageComponent },
      { path: 'suppliers', component: SuppliersPageComponent },
      { path: 'statistics', component: StatisticsPageComponent },
    ],
  },
  { path: '**', redirectTo: '' },
];
