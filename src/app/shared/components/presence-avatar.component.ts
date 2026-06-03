import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UserPresence } from '../../core/services/presence.service';

@Component({
  selector: 'presence-avatar',
  standalone: true,
  imports: [CommonModule, MatTooltipModule],
  template: `
    @if (presence) {
      <div
        class="presence-avatar"
        [style.background-color]="presence.color"
        [matTooltip]="presence.displayName + ' is ' + (presence.viewingEntityId ? 'editing' : 'viewing')"
        matTooltipPosition="above"
      >
        {{ getInitials(presence.displayName) }}
      </div>
    }
  `,
  styles: [`
    .presence-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 10px;
      font-weight: 700;
      flex-shrink: 0;
      cursor: help;
      transition: all 0.2s ease;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .presence-avatar:hover {
      transform: scale(1.15);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    }
  `],
})
export class PresenceAvatarComponent {
  @Input() presence: UserPresence | undefined;

  getInitials(displayName: string): string {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
}
