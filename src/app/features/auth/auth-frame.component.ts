import { Component, Input } from '@angular/core';
import { BandosFullLogoComponent } from '../../shared/components/bandos-full-logo.component';

@Component({
  selector: 'auth-frame',
  standalone: true,
  imports: [BandosFullLogoComponent],
  template: `
    <div class="wrap">
      <div class="card">
        <div class="logo">
          <bandos-full-logo [width]="220" [height]="92"></bandos-full-logo>
        </div>
        @if (title) { <h1>{{ title }}</h1> }
        @if (subtitle) { <p class="bandos-muted">{{ subtitle }}</p> }
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: #050506; }
    .card {
      width: 100%; max-width: 440px; background: #17171B; border: 1px solid #2A2A31;
      border-radius: 16px; padding: 28px; display: flex; flex-direction: column; gap: 16px;
    }
    .logo { display: flex; justify-content: center; margin-bottom: 4px; }
    h1 { margin: 0; font-size: 22px; font-weight: 800; }
    .bandos-muted { color: #9D9DA7; margin: 0; font-size: 14px; }
  `],
})
export class AuthFrameComponent {
  @Input() title?: string;
  @Input() subtitle?: string;
}
