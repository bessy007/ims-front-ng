import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-sales-payment-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sales-payment-dialog.component.html',
})
export class SalesPaymentDialogComponent {
  @Input() open = false;
  @Input() totalAmount = 0;
  @Input() paidTotal = '0';
  @Input() saving = false;

  @Output() paidTotalChange = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();
  @Output() setFull = new EventEmitter<void>();
  @Output() setZero = new EventEmitter<void>();
}
