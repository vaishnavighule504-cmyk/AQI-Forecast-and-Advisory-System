import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnInit, Output, PLATFORM_ID, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AssistantContext, ChatChip, ChatReply, RuleBasedChatProvider } from '../../services/chat-provider';
import { AuthService } from '../../services/auth.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  reply?: ChatReply;
}

@Component({
  selector: 'app-assistant', standalone: true, imports: [CommonModule, FormsModule],
  templateUrl: './assistant.component.html', styleUrl: './assistant.component.css'
})
export class AssistantComponent implements OnInit {
  @Input() context: AssistantContext = {
    city: '', currentAqi: null, band: null, dataStatus: 'unavailable', forecastStatus: 'unavailable', pollutants: null,
    tomorrow: null, dayAfter: null, savedProfile: null, otherCities: []
  };
  @Output() cityChange = new EventEmitter<string>();
  @ViewChild('messageList') private messageList?: ElementRef<HTMLElement>;

  private readonly provider = inject(RuleBasedChatProvider);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly authService = inject(AuthService);
  isOpen = signal(false);
  input = signal('');
  messages = signal<ChatMessage[]>([]);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  private retryQuestion = '';

  readonly starters = [
    { label: 'Today’s AQI?', question: 'What is today’s AQI?' },
    { label: 'Highest pollutant?', question: 'Which pollutant is highest?' },
    { label: 'Tomorrow’s forecast?', question: 'What is tomorrow’s forecast?' },
    { label: 'Outdoor guidance?', question: 'Is it okay to go out today?' }
  ];

  ngOnInit(): void {
    this.restoreHistory();
  }

  toggle(): void {
    this.isOpen.update(open => !open);
    if (this.isOpen() && this.messages().length === 0) {
      const text = 'Hi! I am the SaansCast Assistant. Ask me about air quality, pollutants, forecasts, or guidance.';
      const reply: ChatReply = {
        text, sources: ['No dashboard data used'], sourceLine: 'General knowledge', dataStatus: this.context.dataStatus,
        dataStatusLabel: this.statusLabel(this.context.dataStatus),
        chips: [
          { label: 'Today’s AQI?', question: 'What is today’s AQI?' },
          { label: 'Tomorrow?', question: 'What is tomorrow’s forecast?' },
          { label: 'Highest pollutant?', question: 'Which pollutant is highest?' }
        ]
      };
      this.messages.set([{ role: 'assistant', text, timestamp: new Date().toISOString(), reply }]);
      this.persistHistory();
      this.scrollToLatest();
    }
  }

  close(): void { this.isOpen.set(false); }

  setInput(value: string): void { this.input.set(value.slice(0, 300)); }

  send(question: string): void {
    const text = question.trim().slice(0, 300);
    if (!text || this.isLoading()) return;
    this.input.set('');
    this.errorMessage.set(null);
    this.retryQuestion = text;
    this.messages.update(history => [...history, { role: 'user', text, timestamp: new Date().toISOString() }]);
    this.persistHistory();
    this.scrollToLatest();
    this.answer(text);
  }

  retry(): void {
    if (this.retryQuestion) {
      this.errorMessage.set(null);
      this.answer(this.retryQuestion);
    }
  }

  clearChat(): void {
    this.messages.set([]);
    this.errorMessage.set(null);
    this.retryQuestion = '';
    this.removeStoredHistory();
  }

  activateChip(chip: ChatChip): void {
    if (chip.city) {
      this.cityChange.emit(chip.city);
      this.close();
      return;
    }
    if (chip.question) this.send(chip.question);
  }

  private answer(question: string): void {
    this.isLoading.set(true);
    this.scrollToLatest();
    Promise.resolve().then(() => this.provider.answer(question, this.context)).then(reply => {
      this.messages.update(history => [...history, { role: 'assistant', text: reply.text, timestamp: new Date().toISOString(), reply }]);
      this.isLoading.set(false);
      this.persistHistory();
      this.scrollToLatest();
    }).catch(() => {
      this.errorMessage.set('The assistant could not prepare a reply. Please retry.');
      this.isLoading.set(false);
      this.scrollToLatest();
    });
  }

  private storageKey(): string {
    const user = this.authService.currentUser()?.trim() || 'guest';
    return `saanscast_assistant_${encodeURIComponent(user)}`;
  }

  private restoreHistory(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const raw = sessionStorage.getItem(this.storageKey());
      if (!raw) return;
      const history: unknown = JSON.parse(raw);
      if (Array.isArray(history)) {
        const valid = history.filter((item): item is ChatMessage => !!item &&
          (item as ChatMessage).role !== undefined && ['user', 'assistant'].includes((item as ChatMessage).role) &&
          typeof (item as ChatMessage).text === 'string' && typeof (item as ChatMessage).timestamp === 'string');
        this.messages.set(valid.slice(-100));
      }
    } catch { this.messages.set([]); }
  }

  private persistHistory(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try { sessionStorage.setItem(this.storageKey(), JSON.stringify(this.messages())); }
    catch { /* Chat history remains available for this component session. */ }
  }

  private removeStoredHistory(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try { sessionStorage.removeItem(this.storageKey()); }
    catch { /* Clearing in-memory history still succeeds if storage is unavailable. */ }
  }

  private scrollToLatest(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    setTimeout(() => {
      const list = this.messageList?.nativeElement;
      if (list) list.scrollTop = list.scrollHeight;
    });
  }

  private statusLabel(status: AssistantContext['dataStatus']): string {
    switch (status) {
      case 'live': return 'LIVE';
      case 'stored': return 'LAST STORED READING';
      case 'backend': return 'BACKEND DATA';
      case 'demo': return 'DEMO DATA';
      case 'loading': return 'LOADING';
      default: return 'UNAVAILABLE';
    }
  }
}
