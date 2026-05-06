import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-product-row-context-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-row-context-menu.component.html',
})
export class ProductRowContextMenuComponent {
  @Input() x = 0;
  @Input() y = 0;
  @Input() row: any = null;

  @Output() closed = new EventEmitter<void>();
  @Output() edit = new EventEmitter<any>();
  @Output() view = new EventEmitter<any>();
}
