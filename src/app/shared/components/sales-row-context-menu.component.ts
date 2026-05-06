import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-sales-row-context-menu',
  standalone: true,
  templateUrl: './sales-row-context-menu.component.html',
})
export class SalesRowContextMenuComponent {
  @Input() open = false;
  @Input() x = 0;
  @Input() y = 0;
  @Input() row: any = null;

  @Output() close = new EventEmitter<void>();
  @Output() print = new EventEmitter<any>();
  @Output() edit = new EventEmitter<any>();
  @Output() remove = new EventEmitter<any>();
  @Output() makePayment = new EventEmitter<any>();
  @Output() fiscalize = new EventEmitter<any>();
}
