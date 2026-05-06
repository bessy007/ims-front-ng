import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);

  readonly mainItems: NavItem[] = [
    { path: '/sales', label: 'Sales', icon: 'cart' },
    { path: '/sales/list', label: 'Sales List', icon: 'receipt' },
    { path: '/statistics', label: 'Statistics', icon: 'chart' },
    { path: '/products', label: 'Products', icon: 'box' },
    { path: '/customers', label: 'Customers', icon: 'users' },
  ];

  readonly otherItems: NavItem[] = [
    { path: '/supplies', label: 'Supplies', icon: 'truck' },
    { path: '/transfers', label: 'Transfers', icon: 'swap' },
    { path: '/brands', label: 'Brands', icon: 'tag' },
    { path: '/categories', label: 'Categories', icon: 'grid' },
    { path: '/suppliers', label: 'Suppliers', icon: 'building' },
  ];

  readonly displayName = computed(() => String(this.authService.getStoredUser()?.username ?? 'admin'));

  iconPaths(icon: string) {
    switch (icon) {
      case 'cart':
        return [
          'M3 3h2l2.2 10.2a1 1 0 0 0 1 .8h7.7a1 1 0 0 0 1-.8L20 6H7.1',
          'M9 19a1.5 1.5 0 1 0 0 .01',
          'M17 19a1.5 1.5 0 1 0 0 .01',
        ];
      case 'receipt':
        return [
          'M6 3h12v18l-2.5-1.7L13 21l-2.5-1.7L8 21l-2-1.4V3z',
          'M9 8h6',
          'M9 12h6',
          'M9 16h4',
        ];
      case 'chart':
        return ['M4 19h16', 'M7 15l3-3 3 2 4-6', 'M17 8h-4V4'];
      case 'box':
        return ['M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z', 'M12 3v18', 'M4 7.5l8 4.5 8-4.5'];
      case 'users':
        return [
          'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2',
          'M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
          'M20 21v-2a4 4 0 0 0-3-3.87',
          'M16 3.13a4 4 0 0 1 0 7.75',
        ];
      case 'truck':
        return [
          'M1 7h11v8H1z',
          'M12 10h4l3 3v2h-7z',
          'M5.5 18.5a1.5 1.5 0 1 0 0 .01',
          'M15.5 18.5a1.5 1.5 0 1 0 0 .01',
        ];
      case 'swap':
        return ['M7 7h11l-3-3', 'M18 7l-3 3', 'M17 17H6l3 3', 'M6 17l3-3'];
      case 'tag':
        return ['M20 12l-8 8-9-9V4h7l10 8z', 'M7.5 7.5a1.5 1.5 0 1 0 0 .01'];
      case 'grid':
        return ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'];
      case 'building':
        return [
          'M4 21V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16',
          'M16 9h3a1 1 0 0 1 1 1v11',
          'M8 8h2',
          'M8 12h2',
          'M8 16h2',
          'M12 8h2',
          'M12 12h2',
          'M12 16h2',
          'M9 21v-3h2v3',
        ];
      default:
        return ['M12 5v14', 'M5 12h14'];
    }
  }
}
