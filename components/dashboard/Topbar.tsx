"use client";

import { Search, Plus, Bell, FileText, AlertCircle, Send, Clock, User, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef } from "react";
import { getQuotesToProcessToday } from "@/lib/actions/quotes";
import { searchSuggestions, type SearchSuggestion } from "@/lib/actions/search";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ToProcess = Awaited<ReturnType<typeof getQuotesToProcessToday>>;

export function Topbar() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>("");
  const [userInitial, setUserInitial] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  const [toProcess, setToProcess] = useState<ToProcess | null>(null);
  const [toProcessLoading, setToProcessLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    async function fetchUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
        setUserInitial(user.email.charAt(0).toUpperCase());
      }
    }
    fetchUser();
  }, []);

  // Recherche de suggestions avec debounce
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try {
        const results = await searchSuggestions(searchQuery);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch (error) {
        console.error("Erreur lors de la recherche:", error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Fermer les suggestions quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadToProcess() {
    setToProcessLoading(true);
    try {
      const data = await getQuotesToProcessToday();
      setToProcess(data);
    } finally {
      setToProcessLoading(false);
    }
  }

  const totalToProcess =
    toProcess == null
      ? 0
      : toProcess.expired.length + toProcess.toRelance.length + toProcess.toFinalize.length;

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      if (suggestions.length > 0) {
        // Si on a des suggestions, naviguer vers la première
        router.push(suggestions[0].href);
      } else {
        // Sinon, recherche générale dans les devis
        router.push(`/dashboard/devis?q=${encodeURIComponent(searchQuery.trim())}`);
      }
      setShowSuggestions(false);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  const handleSuggestionClick = (href: string) => {
    router.push(href);
    setShowSuggestions(false);
    setSearchQuery("");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card/80 backdrop-blur-sm px-6">
      {/* Search */}
      <div className="flex-1 max-w-md" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            placeholder="Rechercher un devis, client, immatriculation…"
            className="w-full rounded-input border-border bg-background pl-10 pr-4 py-2 text-sm focus-visible:ring-primary/40"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            onKeyDown={handleSearch}
          />
          
          {/* Suggestions Dropdown */}
          {showSuggestions && (suggestions.length > 0 || isLoadingSuggestions) && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
              {isLoadingSuggestions ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Recherche en cours...
                </div>
              ) : (
                <div className="py-1">
                  {suggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.type}-${suggestion.id}`}
                      onClick={() => handleSuggestionClick(suggestion.href)}
                      className="w-full px-4 py-2 text-left hover:bg-muted/50 transition-colors flex items-center gap-3"
                    >
                      {suggestion.type === "client" ? (
                        <>
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-foreground truncate">
                              {suggestion.name}
                            </div>
                            <div className="text-xs text-muted-foreground">Client</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <Car className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-foreground truncate">
                              {suggestion.registration}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {[suggestion.brand, suggestion.model].filter(Boolean).join(" ") || "Véhicule"}
                              {suggestion.clientName && ` • ${suggestion.clientName}`}
                            </div>
                          </div>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions à droite */}
      <div className="flex items-center gap-3">
        {/* Bouton Nouveau devis */}
        <Button asChild className="rounded-button bg-primary text-primary-foreground shadow-sm hover:shadow-md transition-all duration-200">
          <Link href="/dashboard/devis/new" className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nouveau devis</span>
          </Link>
        </Button>

        {/* Notifications – À traiter */}
        <DropdownMenu onOpenChange={(open) => open && loadToProcess()}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 rounded-button hover:bg-muted/50"
              aria-label="À traiter"
            >
              <Bell className="h-4 w-4" />
              {totalToProcess > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                  {totalToProcess > 9 ? "9+" : totalToProcess}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel className="text-foreground">À traiter</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {toProcessLoading ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Chargement…
              </div>
            ) : toProcess && totalToProcess === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Rien à traiter
              </div>
            ) : toProcess ? (
              <>
                {toProcess.expired.length > 0 && (
                  <>
                    <DropdownMenuLabel className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Devis expirés ({toProcess.expired.length})
                    </DropdownMenuLabel>
                    {toProcess.expired.slice(0, 3).map((q) => (
                      <DropdownMenuItem key={q.id} asChild>
                        <Link href={`/dashboard/devis/${q.id}`} className="flex flex-col items-start gap-0.5 cursor-pointer">
                          <span className="font-medium">{q.reference ?? `#${q.id.slice(0, 8)}`}</span>
                          <span className="text-xs text-muted-foreground">
                            {q.clients?.name ?? "—"}
                          </span>
                        </Link>
                      </DropdownMenuItem>
                    ))}
                    {toProcess.expired.length > 3 && (
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/devis?expired=1" className="text-[#2563eb]">
                          Voir les {toProcess.expired.length} expirés
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                  </>
                )}
                {toProcess.toRelance.length > 0 && (
                  <>
                    <DropdownMenuLabel className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                      <Send className="h-3.5 w-3.5" />
                      À relancer ({toProcess.toRelance.length})
                    </DropdownMenuLabel>
                    {toProcess.toRelance.slice(0, 3).map((q) => (
                      <DropdownMenuItem key={q.id} asChild>
                        <Link href={`/dashboard/devis/${q.id}`} className="flex flex-col items-start gap-0.5 cursor-pointer">
                          <span className="font-medium">{q.reference ?? `#${q.id.slice(0, 8)}`}</span>
                          <span className="text-xs text-muted-foreground">
                            {q.clients?.name ?? "—"}
                          </span>
                        </Link>
                      </DropdownMenuItem>
                    ))}
                    {toProcess.toRelance.length > 3 && (
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/devis?toRelance=1" className="text-[#2563eb]">
                          Voir les {toProcess.toRelance.length} à relancer
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                  </>
                )}
                {toProcess.toFinalize.length > 0 && (
                  <>
                    <DropdownMenuLabel className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      À finaliser ({toProcess.toFinalize.length})
                    </DropdownMenuLabel>
                    {toProcess.toFinalize.slice(0, 3).map((q) => (
                      <DropdownMenuItem key={q.id} asChild>
                        <Link href={`/dashboard/devis/${q.id}`} className="flex flex-col items-start gap-0.5 cursor-pointer">
                          <span className="font-medium">{q.reference ?? `#${q.id.slice(0, 8)}`}</span>
                          <span className="text-xs text-muted-foreground">
                            {q.clients?.name ?? "—"}
                          </span>
                        </Link>
                      </DropdownMenuItem>
                    ))}
                    {toProcess.toFinalize.length > 3 && (
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/devis?status=draft" className="text-[#2563eb]">
                          Voir les {toProcess.toFinalize.length} brouillons
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="font-medium text-[#2563eb]">
                    <FileText className="mr-2 h-4 w-4" />
                    Voir tout sur le tableau de bord
                  </Link>
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User pill */}
        {mounted && userEmail ? (
          <div className="flex items-center gap-2 rounded-full bg-muted/30 px-3 py-1.5 border border-border">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#dbeafe] text-[#2563eb]">
              <span className="text-xs font-semibold">{userInitial}</span>
            </div>
            <span className="hidden md:inline text-sm font-medium text-foreground">
              {userEmail}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-full bg-muted/30 px-3 py-1.5 border border-border">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#dbeafe] text-[#2563eb]">
              <span className="text-xs font-semibold">—</span>
            </div>
            <span className="hidden md:inline text-sm font-medium text-foreground">
              —
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
