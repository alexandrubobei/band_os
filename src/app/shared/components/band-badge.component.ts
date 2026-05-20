import { Component, Input } from '@angular/core';

@Component({
  selector: 'band-badge',
  standalone: true,
  template: `<span class="bandos-pill" [class.accent]="variant === 'accent'" [class.secondary]="variant === 'secondary'">
    <ng-content></ng-content>
  </span>`,
})
export class BandBadgeComponent {
  @Input() variant: 'default' | 'accent' | 'secondary' = 'default';
}
