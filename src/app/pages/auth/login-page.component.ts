import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { UiAlertService } from '../../core/services/ui-alert.service';

const REMEMBER_KEY = 'ims_login_remember_user';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login-page.component.html',
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly alerts = inject(UiAlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly isSubmitting = signal(false);
  readonly form = this.fb.nonNullable.group({
    username: [localStorage.getItem(REMEMBER_KEY) ?? '', Validators.required],
    password: ['', Validators.required],
    remember: [!!localStorage.getItem(REMEMBER_KEY)],
  });

  submit() {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    const { username, password, remember } = this.form.getRawValue();
    this.isSubmitting.set(true);

    this.authService
      .login({ username, password })
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          if (remember) {
            localStorage.setItem(REMEMBER_KEY, username);
          } else {
            localStorage.removeItem(REMEMBER_KEY);
          }

          void this.router.navigate(['/sales']);
        },
        error: (error) => {
          console.error(error);
          this.alerts.error('Login failed');
        },
      });
  }
}
