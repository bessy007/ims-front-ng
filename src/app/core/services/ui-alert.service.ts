import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UiAlertService {
  success(message: string) {
    window.alert(message);
  }

  error(message: string) {
    window.alert(message);
  }

  confirm(message: string) {
    return window.confirm(message);
  }
}
