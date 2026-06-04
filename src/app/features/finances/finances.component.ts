import { Component, computed, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { v4 as uuid } from 'uuid';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { ScreenHeaderComponent } from '../../shared/components/screen-header.component';
import * as M from '../../core/models/models';

@Component({
  selector: 'expense-editor-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <form [formGroup]="form" class="bandos-stack">
      <mat-form-field appearance="outline"><mat-label>Title</mat-label><input matInput formControlName="title" /></mat-form-field>
      <div class="bandos-row">
        <mat-form-field appearance="outline" style="flex:1;"><mat-label>Amount</mat-label><input matInput type="number" formControlName="amount" /></mat-form-field>
        <mat-form-field appearance="outline" style="flex:1;"><mat-label>Date</mat-label><input matInput type="date" formControlName="date" /></mat-form-field>
      </div>
      <mat-form-field appearance="outline">
        <mat-label>Category</mat-label>
        <mat-select formControlName="category">
          @for (c of categories; track c) { <mat-option [value]="c">{{ catLabel(c) }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Paid by</mat-label><input matInput formControlName="paidBy" /></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Notes</mat-label><textarea matInput rows="2" formControlName="notes"></textarea></mat-form-field>
    </form>
    <div class="form-actions">
      @if (existing) { <button mat-button color="warn" style="margin-right: auto;" (click)="delete()">Delete</button> }
      <button mat-flat-button color="primary" (click)="save()">Save</button>
    </div>
  `,
  styles: [`
    .form-actions { display: flex; justify-content: flex-end; align-items: center; margin-top: 24px; gap: 8px; }
  `],
})
export class ExpenseEditorForm {
  private readonly fb = inject(FormBuilder);

  expense: M.FinanceExpense | null = null;
  existing = false;
  categories = Object.values(M.FinanceExpenseCategory);
  catLabel(c: M.FinanceExpenseCategory) { return M.FinanceExpenseCategoryLabel[c]; }

  form = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    amount: [0, [Validators.required, Validators.min(0)]],
    date: [new Date().toISOString().substring(0, 10)],
    category: [M.FinanceExpenseCategory.other],
    paidBy: [''],
    notes: [''],
  });

  onSave?: (result: { action: 'save'; expense: M.FinanceExpense } | { action: 'delete' }) => void;

  init(expense: M.FinanceExpense | null) {
    this.expense = expense;
    this.existing = !!expense;
    this.form.reset({
      title: expense?.title ?? '',
      amount: expense?.amount ?? 0,
      date: (expense?.date ?? new Date()).toISOString().substring(0, 10),
      category: expense?.category ?? M.FinanceExpenseCategory.other,
      paidBy: expense?.paidBy ?? '',
      notes: expense?.notes ?? '',
    });
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const expense: M.FinanceExpense = this.expense
      ? { ...this.expense, ...v, amount: Number(v.amount), date: new Date(v.date) }
      : { id: uuid(), ...v, amount: Number(v.amount), date: new Date(v.date) };
    this.onSave?.({ action: 'save', expense });
  }

  delete() {
    this.onSave?.({ action: 'delete' });
  }
}

@Component({
  selector: 'income-editor-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <form [formGroup]="form" class="bandos-stack">
      <mat-form-field appearance="outline"><mat-label>Title</mat-label><input matInput formControlName="title" /></mat-form-field>
      <div class="bandos-row">
        <mat-form-field appearance="outline" style="flex:1;"><mat-label>Amount</mat-label><input matInput type="number" formControlName="amount" /></mat-form-field>
        <mat-form-field appearance="outline" style="flex:1;"><mat-label>Date</mat-label><input matInput type="date" formControlName="date" /></mat-form-field>
      </div>
      <mat-form-field appearance="outline">
        <mat-label>Source</mat-label>
        <mat-select formControlName="source">
          @for (s of sources; track s) { <mat-option [value]="s">{{ srcLabel(s) }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Received by</mat-label><input matInput formControlName="receivedBy" /></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Notes</mat-label><textarea matInput rows="2" formControlName="notes"></textarea></mat-form-field>
    </form>
    <div class="form-actions">
      @if (existing) { <button mat-button color="warn" style="margin-right: auto;" (click)="delete()">Delete</button> }
      <button mat-flat-button color="primary" (click)="save()">Save</button>
    </div>
  `,
  styles: [`
    .form-actions { display: flex; justify-content: flex-end; align-items: center; margin-top: 24px; gap: 8px; }
  `],
})
export class IncomeEditorForm {
  private readonly fb = inject(FormBuilder);

  income: M.FinanceIncome | null = null;
  existing = false;
  sources = Object.values(M.FinanceIncomeSource);
  srcLabel(s: M.FinanceIncomeSource) { return M.FinanceIncomeSourceLabel[s]; }

  form = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    amount: [0, [Validators.required, Validators.min(0)]],
    date: [new Date().toISOString().substring(0, 10)],
    source: [M.FinanceIncomeSource.other],
    receivedBy: [''],
    notes: [''],
  });

  onSave?: (result: { action: 'save'; income: M.FinanceIncome } | { action: 'delete' }) => void;

  init(income: M.FinanceIncome | null) {
    this.income = income;
    this.existing = !!income;
    this.form.reset({
      title: income?.title ?? '',
      amount: income?.amount ?? 0,
      date: (income?.date ?? new Date()).toISOString().substring(0, 10),
      source: income?.source ?? M.FinanceIncomeSource.other,
      receivedBy: income?.receivedBy ?? '',
      notes: income?.notes ?? '',
    });
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const income: M.FinanceIncome = this.income
      ? { ...this.income, ...v, amount: Number(v.amount), date: new Date(v.date) }
      : { id: uuid(), ...v, amount: Number(v.amount), date: new Date(v.date) };
    this.onSave?.({ action: 'save', income });
  }

  delete() {
    this.onSave?.({ action: 'delete' });
  }
}

@Component({
  selector: 'finances-screen',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatTabsModule, MatIconModule, ScreenHeaderComponent, ExpenseEditorForm, IncomeEditorForm],
  template: `
    <div class="bandos-page">
      <screen-header title="Finances" [subtitle]="subtitle()"></screen-header>
      @if (locked()) {
        <div class="bandos-card" style="border-color:#C8A77B;">
          <h3 style="margin:0 0 6px;">Premium feature</h3>
          <p class="bandos-muted">Finances are available on the Premium plan.</p>
        </div>
      } @else {
        <div class="bandos-grid">
          <mat-card><h3>Income this month</h3><div class="stat">{{ incomeThisMonth() | currency:currency() }}</div></mat-card>
          <mat-card><h3>Expenses this month</h3><div class="stat">{{ expensesThisMonth() | currency:currency() }}</div></mat-card>
          <mat-card><h3>Net this month</h3><div class="stat" [style.color]="net() >= 0 ? '#7BC8A4' : '#EF4A35'">{{ net() | currency:currency() }}</div></mat-card>
          <mat-card><h3>Merch stock value</h3><div class="stat">{{ stockValue() | currency:currency() }}</div></mat-card>
        </div>

        <mat-tab-group>
          <mat-tab label="Expenses">
            <div class="bandos-toolbar" style="margin-top:14px;">
              <button mat-flat-button color="primary" (click)="newExpense()">+ New expense</button>
            </div>
            <div class="bandos-stack" style="margin-top:14px;">
              @for (e of expenses(); track e.id) {
                <mat-card (click)="editExpense(e)" style="cursor:pointer;">
                  <div class="row"><div class="r-title">{{ e.title }}</div><div class="r-amt expense">{{ e.amount | currency:currency() }}</div></div>
                  <div class="meta">{{ catLabel(e.category) }} · {{ e.date | date:'mediumDate' }} · paid by {{ e.paidBy }}</div>
                  @if (e.notes) { <div class="notes">{{ e.notes }}</div> }
                </mat-card>
              }
            </div>
          </mat-tab>
          <mat-tab label="Income">
            <div class="bandos-toolbar" style="margin-top:14px;">
              <button mat-flat-button color="primary" (click)="newIncome()">+ New income</button>
            </div>
            <div class="bandos-stack" style="margin-top:14px;">
              @for (i of incomes(); track i.id) {
                <mat-card (click)="editIncome(i)" style="cursor:pointer;">
                  <div class="row"><div class="r-title">{{ i.title }}</div><div class="r-amt income">{{ i.amount | currency:currency() }}</div></div>
                  <div class="meta">{{ srcLabel(i.source) }} · {{ i.date | date:'mediumDate' }} · {{ i.receivedBy }}</div>
                  @if (i.notes) { <div class="notes">{{ i.notes }}</div> }
                </mat-card>
              }
            </div>
          </mat-tab>
          <mat-tab label="Merch">
            <div class="bandos-stack" style="margin-top:14px;">
              @for (m of merch(); track m.id) {
                <mat-card>
                  <div class="row"><div class="r-title">{{ m.itemName }}</div><div class="r-amt">{{ stockOnHand(m) }} on hand</div></div>
                  <div class="meta">{{ m.unitPrice | currency:currency() }} per unit @if (m.unitCost) { · cost {{ m.unitCost | currency:currency() }} }</div>
                  @if (m.notes) { <div class="notes">{{ m.notes }}</div> }
                </mat-card>
              }
              @if (merch().length === 0) { <p class="bandos-muted">No merch items yet.</p> }
            </div>
          </mat-tab>
        </mat-tab-group>
      }

      <!-- Backdrop -->
      <div class="panel-backdrop" [class.visible]="panelOpen()" (click)="closePanel()"></div>
      <!-- Side panel -->
      <aside class="editor-panel" [class.open]="panelOpen()">
        <div class="panel-header">
          <div class="panel-header-text">
            <span class="panel-label">
              @if (panelMode() === 'expense') {
                {{ panelExpense() ? 'Edit expense' : 'New expense' }}
              } @else {
                {{ panelIncome() ? 'Edit income' : 'New income' }}
              }
            </span>
            @if (panelMode() === 'expense' && panelExpense()?.title) {
              <span class="panel-title">{{ panelExpense()!.title }}</span>
            }
            @if (panelMode() === 'income' && panelIncome()?.title) {
              <span class="panel-title">{{ panelIncome()!.title }}</span>
            }
          </div>
          <button mat-icon-button (click)="closePanel()"><mat-icon>close</mat-icon></button>
        </div>
        <div class="panel-body">
          @if (panelOpen()) {
            @if (panelMode() === 'expense') {
              <expense-editor-form #expenseForm></expense-editor-form>
            } @else {
              <income-editor-form #incomeForm></income-editor-form>
            }
          }
        </div>
      </aside>
    </div>
  `,
  styles: [`
    h3 { margin: 0 0 8px; font-size: 13px; color: #9D9DA7; font-weight: 600; }
    .stat { font-size: 26px; font-weight: 800; }
    .row { display: flex; justify-content: space-between; align-items: center; }
    .r-title { font-weight: 700; }
    .r-amt { font-weight: 800; }
    .r-amt.income { color: #7BC8A4; }
    .r-amt.expense { color: #EF4A35; }
    .meta { color: #9D9DA7; font-size: 12px; margin-top: 4px; }
    .notes { color: #C7C7CF; font-size: 13px; margin-top: 8px; }

    /* ── Side panel ── */
    .panel-backdrop { position: fixed; inset: 0; z-index: 200; background: transparent; pointer-events: none; transition: background 0.25s ease; }
    .panel-backdrop.visible { background: rgba(0,0,0,0.35); }
    .editor-panel { position: fixed; top: 16px; right: 16px; bottom: 16px; width: 460px; z-index: 201; background: #20202A; border: 1px solid #383842; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; transform: translateX(calc(100% + 32px)); transition: transform 0.3s cubic-bezier(0.4,0,0.2,1); box-shadow: 0 12px 48px rgba(0,0,0,0.55); }
    .editor-panel.open { transform: translateX(0); }
    .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 14px; border-bottom: 1px solid #383842; flex-shrink: 0; }
    .panel-header-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
    .panel-label { font-size: 11px; font-weight: 700; color: #9D9DA7; text-transform: uppercase; letter-spacing: 0.06em; }
    .panel-title { font-size: 17px; font-weight: 800; color: #CDCDD3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .panel-body { flex: 1; overflow-y: auto; padding: 20px; }
    @media (max-width: 760px) { .editor-panel { inset: 0; width: 100%; border-radius: 0; border: none; } }
  `],
})
export class FinancesComponent {
  private readonly wsc = inject(WorkspaceController);

  workspace = computed(() => this.wsc.workspace());
  locked = computed(() => { const w = this.workspace(); return w ? !M.wsSupportsFinances(w) : false; });
  currency = computed(() => M.WorkspaceCurrencyCode[this.workspace()?.currency ?? M.WorkspaceCurrency.eur]);
  subtitle = computed(() => this.workspace()?.bandName ?? '');

  expenses = computed(() => [...(this.workspace()?.expenses ?? [])].sort((a, b) => b.date.getTime() - a.date.getTime()));
  incomes = computed(() => [...(this.workspace()?.incomes ?? [])].sort((a, b) => b.date.getTime() - a.date.getTime()));
  merch = computed(() => this.workspace()?.merchItems ?? []);

  incomeThisMonth = computed(() => this.workspace() ? M.wsIncomeThisMonth(this.workspace()!) : 0);
  expensesThisMonth = computed(() => this.workspace() ? M.wsExpensesThisMonth(this.workspace()!) : 0);
  net = computed(() => this.workspace() ? M.wsNetThisMonth(this.workspace()!) : 0);
  stockValue = computed(() => this.merch().reduce((sum, m) => sum + M.merchStockOnHand(m) * m.unitPrice, 0));

  catLabel(c: M.FinanceExpenseCategory) { return M.FinanceExpenseCategoryLabel[c]; }
  srcLabel(s: M.FinanceIncomeSource) { return M.FinanceIncomeSourceLabel[s]; }
  stockOnHand(m: M.MerchItem) { return M.merchStockOnHand(m); }

  panelOpen = signal(false);
  private _keepPanelOpen = false;
  panelMode = signal<'expense' | 'income'>('expense');
  panelExpense = signal<M.FinanceExpense | null>(null);
  panelIncome = signal<M.FinanceIncome | null>(null);

  openExpensePanel(e?: M.FinanceExpense) {
    this.panelMode.set('expense');
    this.panelExpense.set(e ?? null);
    this.panelOpen.set(true); this._keepPanelOpen = true; setTimeout(() => (this._keepPanelOpen = false));
  }

  openIncomePanel(i?: M.FinanceIncome) {
    this.panelMode.set('income');
    this.panelIncome.set(i ?? null);
    this.panelOpen.set(true); this._keepPanelOpen = true; setTimeout(() => (this._keepPanelOpen = false));
  }

  closePanel() { this.panelOpen.set(false); }

  @HostListener('document:keydown.escape')
  onEscape() { if (this.panelOpen()) this.closePanel(); }

  @HostListener("document:click", ["$event"])
  onDocumentClick(ev: MouseEvent) {
    if (!this.panelOpen()) return;
    if (this._keepPanelOpen) { this._keepPanelOpen = false; return; }
    const target = ev.target as HTMLElement | null;
    if (target && target.closest(".editor-panel, .songs-panel, .cdk-overlay-container")) return;
    this.closePanel();
  }

  newExpense() { this.openExpensePanel(); }

  editExpense(e: M.FinanceExpense) { this.openExpensePanel(e); }

  async handleExpenseSave(result: { action: 'save'; expense: M.FinanceExpense } | { action: 'delete' }) {
    const ws = this.workspace()!;
    if (result.action === 'save') {
      const existing = ws.expenses.find(x => x.id === result.expense.id);
      if (existing) {
        const next = ws.expenses.map(x => x.id === result.expense.id ? result.expense : x);
        await this.wsc.saveFinances({ expenses: next });
      } else {
        await this.wsc.saveFinances({ expenses: [result.expense, ...ws.expenses] });
      }
      this.closePanel();
    } else if (result.action === 'delete') {
      const expense = this.panelExpense();
      if (expense) {
        await this.wsc.saveFinances({ expenses: ws.expenses.filter(x => x.id !== expense.id) });
      }
      this.closePanel();
    }
  }

  newIncome() { this.openIncomePanel(); }

  editIncome(i: M.FinanceIncome) { this.openIncomePanel(i); }

  async handleIncomeSave(result: { action: 'save'; income: M.FinanceIncome } | { action: 'delete' }) {
    const ws = this.workspace()!;
    if (result.action === 'save') {
      const existing = ws.incomes.find(x => x.id === result.income.id);
      if (existing) {
        const next = ws.incomes.map(x => x.id === result.income.id ? result.income : x);
        await this.wsc.saveFinances({ incomes: next });
      } else {
        await this.wsc.saveFinances({ incomes: [result.income, ...ws.incomes] });
      }
      this.closePanel();
    } else if (result.action === 'delete') {
      const income = this.panelIncome();
      if (income) {
        await this.wsc.saveFinances({ incomes: ws.incomes.filter(x => x.id !== income.id) });
      }
      this.closePanel();
    }
  }
}
