import { Component, Input } from '@angular/core';
import { memberInitials } from '../../core/models/models';

@Component({
  selector: 'band-avatar',
  standalone: true,
  template: `
    @if (logoUrl) {
      <img [src]="logoUrl" alt="" [style.width.px]="size" [style.height.px]="size"
        style="border-radius:12px;object-fit:cover;border:1px solid #383842;" />
    } @else {
      <div
        [style.width.px]="size"
        [style.height.px]="size"
        style="display:inline-flex;align-items:center;justify-content:center;border-radius:12px;background:#1D1D23;color:#CDCDD3;border:1px solid #383842;font-weight:700;"
        [style.font-size.px]="size / 2.5">
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
