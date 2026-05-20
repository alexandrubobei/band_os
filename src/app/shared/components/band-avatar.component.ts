import { Component, Input, computed, signal } from '@angular/core';
import { memberInitials } from '../../core/models/models';

@Component({
  selector: 'band-avatar',
  standalone: true,
  template: `
    @if (logoUrl) {
      <img [src]="logoUrl" alt="" [style.width.px]="size" [style.height.px]="size"
        style="border-radius:12px;object-fit:cover;border:1px solid #2A2A31;" />
    } @else {
      <div
        [style.width.px]="size"
        [style.height.px]="size"
        style="display:inline-flex;align-items:center;justify-content:center;border-radius:12px;background:#1D1D23;color:#F6F1E8;border:1px solid #2A2A31;font-weight:700;"
        [style.fontSize.px]="size / 2.5">
        {{ initialsValue }}
      </div>
    }
  `,
})
export class BandAvatarComponent {
  @Input() displayName = '';
  @Input() logoUrl?: string | null;
  @Input() size = 48;
  get initialsValue() { return memberInitials(this.displayName); }
}
