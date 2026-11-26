import AsyncStorage from "@react-native-async-storage/async-storage";
import { IBMPlexSans_400Regular } from "@expo-google-fonts/ibm-plex-sans";
import { Newsreader_500Medium } from "@expo-google-fonts/newsreader";
import * as FileSystem from "expo-file-system";
import { useFonts } from "expo-font";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

type User = { id: string; name: string; email: string; role: string };
type Book = {
  id: string;
  title: string;
  author: string;
  category: string;
  year: number;
  description: string;
  sourceUrl?: string | null;
  coverUrl?: string | null;
  inLibrary?: boolean;
  isFavorite?: boolean;
};
type Quota = { limit: number; remaining: number; mode: string };
type Trace = { name: string };
type Pending = { confirmationId: string; title: string; author: string };
type Message = { role: "user" | "assistant"; content: string; trace?: Trace[]; pending?: Pending | null };
type Tab = "catalog" | "library" | "favorites" | "account";

const DEFAULT_URL = Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000";
const SERIF = "Newsreader_500Medium";
const SANS = "IBMPlexSans_400Regular";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "catalog", label: "Catalog" },
  { id: "library", label: "Library" },
  { id: "favorites", label: "Favorites" },
  { id: "account", label: "Account" },
];
const SUGGESTIONS = [
  { label: "A sea adventure", text: "Recommend a sea adventure and tell me about the closest match" },
  { label: "Dracula and Frankenstein", text: "Compare Dracula and Frankenstein" },
  { label: "Save Treasure Island", text: "Add Treasure Island to my library" },
];
const CATALOG_PAGE_SIZE = 30;
const TOOL_LABELS: Record<string, string> = {
  search_books: "Search",
  get_book_details: "Details",
  add_to_my_library: "Save",
  compare_books: "Compare",
};

function toolLabel(name: string) {
  return TOOL_LABELS[name] ?? "Search";
}

function coverSource(url?: string | null) {
  return url && /^https?:\/\//i.test(url) ? url : "";
}

function CoverFace({ book, detail = false }: { book: Book; detail?: boolean }) {
  const source = coverSource(book.coverUrl);
  const [failed, setFailed] = useState(false);
  if (source && !failed) {
    return (
      <Image
        source={{ uri: source }}
        style={detail ? styles.coverPhoto : styles.tilePhoto}
        resizeMode="cover"
        onError={() => setFailed(true)}
        accessibilityLabel={book.title}
      />
    );
  }
  if (detail) {
    return (
      <View style={styles.cover}>
        <View style={styles.spine} />
        <View style={styles.jacket} />
        <Text style={styles.coverKicker}>{book.category}</Text>
        <Text style={styles.coverTitle}>{book.title}</Text>
      </View>
    );
  }
  return (
    <View style={styles.tileCover}>
      <View style={styles.spine} />
      <View style={styles.jacket} />
      <Text style={styles.tileKicker} numberOfLines={1}>{book.category}</Text>
      <Text style={styles.tileTitle} numberOfLines={2}>{book.title}</Text>
    </View>
  );
}

async function request(base: string, path: string, token: string | null, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const failure = new Error(data.error || "Request failed.") as Error & { code?: string };
    failure.code = typeof data.code === "string" ? data.code : undefined;
    throw failure;
  }
  return data;
}

export default function App() {
  const [fontsLoaded] = useFonts({ Newsreader_500Medium, IBMPlexSans_400Regular });
  const [base, setBase] = useState(DEFAULT_URL);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("catalog");
  const [query, setQuery] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const catalogList = useRef<FlatList<Book>>(null);
  const [selected, setSelected] = useState<Book | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [error, setError] = useState("");
  const [accountMode, setAccountMode] = useState<"sign-in" | "register" | "code">("sign-in");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountFocus, setAccountFocus] = useState("");
  const [note, setNote] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: "Ask about a book. I will ask before I save one.",
  }]);

  useEffect(() => {
    (async () => {
      const [savedUrl, savedToken] = await Promise.all([
        AsyncStorage.getItem("elibrary.api"),
        AsyncStorage.getItem("elibrary.token"),
      ]);
      if (savedUrl) setBase(savedUrl);
      if (savedToken) setToken(savedToken);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const active = base;
    request(active, "/api/downloads/quota", token)
      .then(setQuota)
      .catch(() => setQuota(null));
    if (!token) {
      setUser(null);
      return;
    }
    request(active, "/api/auth/me", token)
      .then((data) => setUser(data.user))
      .catch(() => {
        setToken(null);
        AsyncStorage.removeItem("elibrary.token");
      });
  }, [ready, base, token]);

  useEffect(() => {
    if (!ready) return;
    request(base, "/api/books/categories", null)
      .then((data) => setCategories(data.categories.map((item: { name: string }) => item.name)))
      .catch(() => setCategories([]));
  }, [ready, base]);

  useEffect(() => {
    if (!ready || tab === "account") return;
    const path = tab === "catalog"
      ? `/api/books?q=${encodeURIComponent(query)}&author=${encodeURIComponent(author)}&category=${encodeURIComponent(category)}&page=${page}&pageSize=${CATALOG_PAGE_SIZE}`
      : `/api/user/${tab}`;
    if (tab !== "catalog" && !token) {
      setBooks([]);
      return;
    }
    request(base, path, token)
      .then((data) => {
        setBooks(data.books);
        if (tab === "catalog") setCatalogTotal(typeof data.total === "number" ? data.total : 0);
      })
      .catch((reason) => setError(reason.message));
  }, [ready, tab, query, author, category, page, token, base]);

  useEffect(() => {
    catalogList.current?.scrollToOffset({ offset: 0, animated: false });
  }, [page]);

  async function signIn() {
    setError("");
    try {
      const data = await request(base, "/api/auth/login", null, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      setUser(data.user);
      await AsyncStorage.setItem("elibrary.token", data.token);
      setTab("catalog");
    } catch (reason) {
      const coded = reason as Error & { code?: string };
      if (coded.code === "unconfirmed") setAccountMode("code");
      setError(reason instanceof Error ? reason.message : "Could not sign in.");
    }
  }

  async function register() {
    setError("");
    try {
      const data = await request(base, "/api/auth/register", null, {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      if (data.pending || !data.token) {
        setAccountMode("code");
        return;
      }
      setToken(data.token);
      setUser(data.user);
      await AsyncStorage.setItem("elibrary.token", data.token);
      setTab("catalog");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the account.");
    }
  }

  async function sendNewCode() {
    setError("");
    try {
      await request(base, "/api/auth/code", null, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send a new code.");
    }
  }

  async function confirmCode() {
    setError("");
    try {
      const data = await request(base, "/api/auth/verify", null, {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      setToken(data.token);
      setUser(data.user);
      await AsyncStorage.setItem("elibrary.token", data.token);
      setTab("catalog");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not confirm the code.");
    }
  }

  async function signOut() {
    setError("");
    try {
      await request(base, "/api/auth/logout", token, { method: "POST" });
    } catch {
      // The token is still cleared so the next visit is a guest.
    }
    setToken(null);
    setUser(null);
    setSelected(null);
    await AsyncStorage.removeItem("elibrary.token");
    setTab("catalog");
  }

  async function saveBase(next: string) {
    setBase(next);
    await AsyncStorage.setItem("elibrary.api", next);
  }

  async function download(book: Book) {
    setError("");
    try {
      const headers = new Headers();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const response = await fetch(`${base}/api/downloads/${book.id}`, { method: "POST", headers });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Download blocked.");
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      }
      const filename = `${book.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "book"}.pdf`;
      const uri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(uri, btoa(binary), { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
      setNote("Download started.");
      const next = await request(base, "/api/downloads/quota", token);
      setQuota(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Download failed.");
    }
  }

  async function openBook(item: Book) {
    setNote("");
    setError("");
    setSelected(item);
    try {
      const data = await request(base, `/api/books/${item.id}`, token);
      setSelected(data.book);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load this book.");
    }
  }

  async function saveBook(book: Book) {
    if (!token) {
      setSelected(null);
      setTab("account");
      return;
    }
    setError("");
    try {
      await request(base, "/api/user/library", token, { method: "POST", body: JSON.stringify({ bookId: book.id }) });
      setSelected({ ...book, inLibrary: true });
      setNote("Saved.");
    } catch (reason) {
      setNote("");
      setError(reason instanceof Error ? reason.message : "Could not update your shelf.");
    }
  }

  async function favoriteBook(book: Book) {
    if (!token) {
      setSelected(null);
      setTab("account");
      return;
    }
    setError("");
    try {
      if (book.isFavorite) {
        await request(base, `/api/user/favorites/${book.id}`, token, { method: "DELETE" });
        setSelected({ ...book, isFavorite: false });
        setNote("Removed from Favorites.");
      } else {
        await request(base, "/api/user/favorites", token, { method: "POST", body: JSON.stringify({ bookId: book.id }) });
        setSelected({ ...book, isFavorite: true });
        setNote("Saved to Favorites.");
      }
    } catch (reason) {
      setNote("");
      setError(reason instanceof Error ? reason.message : "Could not update Favorites.");
    }
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const history = [...messages, { role: "user" as const, content }];
    setMessages(history);
    setDraft("");
    setBusy(true);
    try {
      const sessionId = (await AsyncStorage.getItem("elibrary.chat")) || `mobile-${Date.now()}`;
      await AsyncStorage.setItem("elibrary.chat", sessionId);
      const result = await request(base, "/api/ai/chat", token, {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          messages: history.map(({ role, content: value }) => ({ role, content: value })),
        }),
      });
      setMessages((current) => [...current, { role: "assistant", content: result.reply, trace: result.toolTrace, pending: result.pendingAction }]);
    } catch (reason) {
      setMessages((current) => [...current, { role: "assistant", content: reason instanceof Error ? reason.message : "Unavailable." }]);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(confirmationId: string, accept: boolean) {
    setBusy(true);
    try {
      const result = await request(base, "/api/ai/confirm", token, {
        method: "POST",
        body: JSON.stringify({ confirmationId, accept }),
      });
      setMessages((current) => current.map((message) => (
        message.pending?.confirmationId === confirmationId ? { ...message, pending: null } : message
      )).concat({ role: "assistant", content: result.reply, trace: result.toolTrace }));
    } catch (reason) {
      setMessages((current) => [...current, { role: "assistant", content: reason instanceof Error ? reason.message : "Could not confirm." }]);
    } finally {
      setBusy(false);
    }
  }

  const { width: screenWidth } = useWindowDimensions();
  const catalogPages = Math.max(1, Math.ceil(catalogTotal / CATALOG_PAGE_SIZE));
  const columns = screenWidth > 600 ? 3 : 2;
  const tileGap = 8;
  const tileWidth = (screenWidth - 32 - tileGap * (columns - 1)) / columns;

  if (!ready || !fontsLoaded) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.brand}>The Emerald Archive</Text>
        <Text style={styles.quota}>{quota ? `${quota.remaining} of ${quota.limit} downloads left` : "Connecting…"}</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {tab === "account" ? (
        <ScrollView style={styles.flex} contentContainerStyle={styles.body}>
          <View style={styles.form}>
            {user ? (
              <>
                <Text style={styles.heading}>{user.name}</Text>
                <Text style={styles.muted}>{user.email}</Text>
                <Pressable onPress={signOut}><Text style={styles.link}>Log out</Text></Pressable>
              </>
            ) : accountMode === "code" ? (
              <>
                <Text style={styles.heading}>Enter the code</Text>
                <Text style={styles.muted}>We sent a 6-digit code to {email}.</Text>
                <View style={styles.field}>
                  <Text style={styles.label}>Code</Text>
                  <TextInput style={[styles.accountInput, accountFocus === "code" && styles.accountInputOn]} value={code} onChangeText={setCode} keyboardType="number-pad" onFocus={() => setAccountFocus("code")} onBlur={() => setAccountFocus("")} />
                </View>
                <Pressable style={styles.solid} onPress={confirmCode}><Text style={styles.solidText}>Confirm</Text></Pressable>
                <Pressable style={styles.linkCenter} onPress={sendNewCode}><Text style={styles.link}>Send a new code</Text></Pressable>
              </>
            ) : accountMode === "register" ? (
              <>
                <Text style={styles.heading}>Create an account</Text>
                <View style={styles.field}>
                  <Text style={styles.label}>Name</Text>
                  <TextInput style={[styles.accountInput, accountFocus === "name" && styles.accountInputOn]} value={name} onChangeText={setName} autoCapitalize="words" onFocus={() => setAccountFocus("name")} onBlur={() => setAccountFocus("")} />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput style={[styles.accountInput, accountFocus === "register-email" && styles.accountInputOn]} autoCapitalize="none" value={email} onChangeText={setEmail} onFocus={() => setAccountFocus("register-email")} onBlur={() => setAccountFocus("")} />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput style={[styles.accountInput, accountFocus === "register-password" && styles.accountInputOn]} secureTextEntry value={password} onChangeText={setPassword} onFocus={() => setAccountFocus("register-password")} onBlur={() => setAccountFocus("")} />
                  <Text style={styles.muted}>Use at least 8 characters.</Text>
                </View>
                <Pressable style={styles.solid} onPress={register}><Text style={styles.solidText}>Create account</Text></Pressable>
                <Pressable style={styles.linkCenter} onPress={() => { setAccountMode("sign-in"); setError(""); setEmail(""); setPassword(""); }}>
                  <Text style={styles.link}>Sign in</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.heading}>Sign in</Text>
                <Text style={styles.muted}>Save books to My Library and Favorites.</Text>
                <View style={styles.field}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput style={[styles.accountInput, accountFocus === "email" && styles.accountInputOn]} autoCapitalize="none" value={email} onChangeText={setEmail} onFocus={() => setAccountFocus("email")} onBlur={() => setAccountFocus("")} />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput style={[styles.accountInput, accountFocus === "password" && styles.accountInputOn]} secureTextEntry value={password} onChangeText={setPassword} onFocus={() => setAccountFocus("password")} onBlur={() => setAccountFocus("")} />
                </View>
                <Pressable style={styles.solid} onPress={signIn}><Text style={styles.solidText}>Sign in</Text></Pressable>
                <Pressable style={styles.linkCenter} onPress={() => { setAccountMode("register"); setError(""); setName(""); setEmail(""); setPassword(""); }}>
                  <Text style={styles.link}>Create an account</Text>
                </Pressable>
                <View style={styles.classSignin}>
                  <Text style={styles.muted}>Class sign-in</Text>
                  <Text style={styles.muted}>Reader: reader@elibrary.local / Reader123!</Text>
                  <Text style={styles.muted}>Admin: admin@elibrary.local / Admin123!</Text>
                </View>
              </>
            )}
            <View style={styles.field}>
              <Text style={styles.label}>API address</Text>
              <TextInput style={[styles.accountInput, accountFocus === "api" && styles.accountInputOn]} autoCapitalize="none" value={base} onChangeText={saveBase} onFocus={() => setAccountFocus("api")} onBlur={() => setAccountFocus("")} />
            </View>
            <Text style={styles.muted}>The emulator uses 10.0.2.2, and a phone on the same Wi-Fi uses the computer's LAN address.</Text>
          </View>
        </ScrollView>
      ) : selected ? (
        <ScrollView style={styles.flex} contentContainerStyle={styles.body}>
          <Pressable onPress={() => { setNote(""); setSelected(null); }}><Text style={styles.link}>Back to the shelf</Text></Pressable>
          <CoverFace book={selected} detail />
          <Text style={styles.meta}>{selected.author} · {selected.year}</Text>
          <Text style={styles.copy}>{selected.description}</Text>
          {note ? <Text style={styles.note}>{note}</Text> : null}
          <Pressable style={styles.solid} onPress={() => download(selected)}><Text style={styles.solidText}>Download PDF</Text></Pressable>
          {token ? (
            <>
              <Pressable onPress={() => saveBook(selected)}><Text style={styles.link}>Add to My Library</Text></Pressable>
              <Pressable onPress={() => favoriteBook(selected)}><Text style={styles.link}>{selected.isFavorite ? "Unfavorite" : "Favorite"}</Text></Pressable>
            </>
          ) : (
            <Pressable onPress={() => { setNote(""); setSelected(null); setTab("account"); }}><Text style={styles.link}>Sign in to save this book</Text></Pressable>
          )}
        </ScrollView>
      ) : (
        <View style={styles.flex}>
          {tab === "catalog" && (
            <View style={styles.catalogHead}>
              <Text style={styles.pageTitle}>Catalog</Text>
              <TextInput style={[styles.search, styles.searchFlush]} value={query} onChangeText={(text) => { setQuery(text); setPage(1); }} placeholder="Search title, author, or theme" placeholderTextColor="#645c52" />
              <TextInput style={[styles.search, styles.searchFlush]} value={author} onChangeText={(text) => { setAuthor(text); setPage(1); }} placeholder="Author" placeholderTextColor="#645c52" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                <Pressable onPress={() => { setCategory(""); setPage(1); }}><Text style={category === "" ? styles.tabOn : styles.tab}>All</Text></Pressable>
                {categories.map((name) => (
                  <Pressable key={name} onPress={() => { setCategory(name); setPage(1); }}><Text style={category === name ? styles.tabOn : styles.tab}>{name}</Text></Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          {!token && tab !== "catalog" ? (
            <Text style={styles.empty} onPress={() => setTab("account")}>Sign in to see this shelf.</Text>
          ) : books.length === 0 && tab !== "catalog" ? (
            <Text style={styles.empty}>Nothing here yet. Ask the librarian to save a book, then confirm it.</Text>
          ) : books.length === 0 && (query.trim() || author.trim() || category) ? (
            <Text style={styles.empty}>No books match this search.</Text>
          ) : (
            <FlatList
              ref={catalogList}
              key={columns}
              data={books}
              keyExtractor={(item) => item.id}
              numColumns={columns}
              columnWrapperStyle={{ gap: tileGap }}
              contentContainerStyle={styles.list}
              ListFooterComponent={tab === "catalog" ? (
                <View style={styles.pager}>
                  <Pressable style={[styles.ghost, page <= 1 && styles.pagerOff]} disabled={page <= 1} onPress={() => setPage((value) => Math.max(1, value - 1))}>
                    <Text style={styles.ghostText}>Previous</Text>
                  </Pressable>
                  <Text style={styles.muted}>Page {page} of {catalogPages}</Text>
                  <Pressable style={[styles.ghost, page >= catalogPages && styles.pagerOff]} disabled={page >= catalogPages} onPress={() => setPage((value) => value + 1)}>
                    <Text style={styles.ghostText}>Next</Text>
                  </Pressable>
                </View>
              ) : null}
              renderItem={({ item }) => (
                <Pressable style={[styles.tile, { width: tileWidth }]} onPress={() => openBook(item)}>
                  <CoverFace book={item} />
                  <Text style={styles.tileMeta} numberOfLines={1}>{item.author} · {item.year}</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      )}
      <View style={styles.footer}>
        <Pressable style={styles.solid} onPress={() => setChatOpen(true)}>
          <Text style={styles.solidText}>Ask the librarian</Text>
        </Pressable>
        <View style={styles.tabs}>
          {TABS.map((item) => (
            <Pressable key={item.id} onPress={() => { setTab(item.id); setSelected(null); }}>
              <Text style={tab === item.id ? styles.tabOn : styles.tab}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Modal visible={chatOpen} transparent animationType="slide" onRequestClose={() => setChatOpen(false)}>
        <View style={styles.sheetWrap}>
          <Pressable style={styles.backdrop} onPress={() => setChatOpen(false)} />
          <SafeAreaView style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.heading}>Librarian</Text>
              <Pressable onPress={() => setChatOpen(false)}><Text style={styles.link}>Close</Text></Pressable>
            </View>
            <ScrollView style={styles.flex} contentContainerStyle={styles.chatLog}>
              {messages.map((message, index) => (
                <View key={index} style={styles.message}>
                  <View style={message.role === "user" ? styles.userBubble : styles.bubble}>
                    <Text style={message.role === "user" ? styles.userText : styles.bodyText}>{message.content}</Text>
                  </View>
                  {message.trace && message.trace.length > 0 ? (
                    <Text style={styles.trace}>Tools used: {message.trace.map((tool) => toolLabel(tool.name)).join(" → ")}</Text>
                  ) : null}
                  {message.pending ? (
                    <View style={styles.row}>
                      <Text style={styles.bodyText}>Save {message.pending.title}?</Text>
                      <Pressable style={styles.solid} onPress={() => confirm(message.pending!.confirmationId, true)}><Text style={styles.solidText}>Confirm</Text></Pressable>
                      <Pressable style={styles.ghost} onPress={() => confirm(message.pending!.confirmationId, false)}><Text style={styles.ghostText}>Cancel</Text></Pressable>
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>
            {messages.length < 2 && (
              <View style={styles.prompts}>
                {SUGGESTIONS.map((prompt) => (
                  <Pressable key={prompt.label} onPress={() => send(prompt.text)}>
                    <Text style={styles.link}>{prompt.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <View style={styles.composer}>
              <TextInput style={styles.input} value={draft} onChangeText={setDraft} placeholder="Ask about the catalog" placeholderTextColor="#645c52" />
              <Pressable style={styles.solid} onPress={() => send(draft)}><Text style={styles.solidText}>{busy ? "..." : "Send"}</Text></Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3eadc" },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f3eadc" },
  header: { paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16 },
  brand: { fontFamily: SERIF, fontSize: 22, fontWeight: "500", color: "#1c1712" },
  heading: { fontFamily: SANS, fontSize: 24, color: "#1c1712" },
  pageTitle: { fontFamily: SERIF, fontWeight: "500", fontSize: 22, color: "#1c1712" },
  catalogHead: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, gap: 8 },
  filterRow: { gap: 16, alignItems: "center" },
  searchFlush: { margin: 0 },
  form: { width: "100%", maxWidth: 448, gap: 16, padding: 8, backgroundColor: "#fffaf3", borderWidth: 1, borderColor: "#e2d5c3", borderRadius: 12, shadowColor: "#1c1712", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  accountInputOn: { borderColor: "#1c1712" },
  linkCenter: { alignSelf: "center" },
  classSignin: { gap: 4, borderTopWidth: 1, borderTopColor: "#e2d5c3", paddingTop: 16 },
  field: { gap: 8 },
  accountInput: { fontFamily: SANS, backgroundColor: "#fffaf3", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: "#e2d5c3", fontSize: 15, color: "#1c1712" },
  note: { fontFamily: SANS, color: "#645c52", fontSize: 13 },
  quota: { fontFamily: SANS, color: "#645c52", fontSize: 13, flexShrink: 1, textAlign: "right" },
  muted: { fontFamily: SANS, color: "#645c52", fontSize: 13 },
  meta: { fontFamily: SANS, color: "#645c52", fontSize: 13, padding: 16 },
  error: { fontFamily: SANS, color: "#8d2f2a", backgroundColor: "#fffaf3", borderColor: "#e7c6c2", borderWidth: 1, borderRadius: 12, marginHorizontal: 16, marginBottom: 16, padding: 16 },
  empty: { fontFamily: SANS, color: "#1c1712", backgroundColor: "#fffaf3", borderColor: "#e2d5c3", borderWidth: 1, borderRadius: 12, margin: 16, padding: 16, fontSize: 15, lineHeight: 22 },
  body: { padding: 16, gap: 16 },
  bodyText: { fontFamily: SANS, color: "#1c1712", fontSize: 15, lineHeight: 22 },
  copy: { fontFamily: SANS, fontSize: 15, lineHeight: 22, color: "#1c1712" },
  search: { fontFamily: SANS, margin: 16, backgroundColor: "#fffaf3", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: "#e2d5c3", fontSize: 15, color: "#1c1712" },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  pager: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16, paddingTop: 16 },
  pagerOff: { opacity: 0.4 },
  tile: { backgroundColor: "transparent", borderRadius: 4 },
  tileCover: { height: 104, backgroundColor: "#1e4636", padding: 12, paddingLeft: 14, justifyContent: "space-between", borderRadius: 4, overflow: "hidden" },
  tilePhoto: { height: 104, width: "100%", borderRadius: 4, backgroundColor: "#1e4636" },
  tileKicker: { fontFamily: SANS, color: "#f6f1e7", fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase" },
  tileTitle: { fontFamily: SERIF, fontWeight: "500", color: "#f6f1e7", fontSize: 15, lineHeight: 18 },
  tileMeta: { fontFamily: SANS, color: "#645c52", fontSize: 13, lineHeight: 16, paddingTop: 8, backgroundColor: "transparent" },
  cover: { position: "relative", backgroundColor: "#1e4636", minHeight: 200, padding: 16, paddingLeft: 18, justifyContent: "space-between", gap: 16, borderRadius: 4, overflow: "hidden" },
  coverPhoto: { width: "100%", height: 200, borderRadius: 4, backgroundColor: "#1e4636" },
  spine: { position: "absolute", left: 0, top: 0, bottom: 0, width: 6, backgroundColor: "#143028" },
  jacket: { position: "absolute", top: 8, left: 8, right: 8, bottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  coverKicker: { fontFamily: SANS, color: "#f6f1e7", fontSize: 13, letterSpacing: 0.6, textTransform: "uppercase" },
  coverTitle: { fontFamily: SERIF, fontWeight: "500", color: "#f6f1e7", fontSize: 22 },
  input: { fontFamily: SANS, backgroundColor: "#fffaf3", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: "#e2d5c3", flex: 1, fontSize: 15, color: "#1c1712" },
  solid: { backgroundColor: "#1e4636", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, alignItems: "center", borderWidth: 1, borderColor: "#1e4636" },
  solidText: { fontFamily: SANS, color: "#f6f1e7", fontSize: 15 },
  ghost: { borderWidth: 1, borderColor: "#1c1712", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, alignItems: "center", backgroundColor: "#fffaf3" },
  ghostText: { fontFamily: SANS, color: "#1c1712", fontSize: 15 },
  link: { fontFamily: SANS, color: "#1c1712", fontSize: 15, textDecorationLine: "underline" },
  label: { fontFamily: SANS, fontSize: 13, color: "#645c52" },
  footer: { borderTopWidth: 1, borderColor: "#e2d5c3", backgroundColor: "#f3eadc", paddingTop: 16, paddingHorizontal: 16, gap: 16 },
  tabs: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 8 },
  tab: { fontFamily: SANS, color: "#645c52", fontSize: 13, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabOn: { fontFamily: SANS, color: "#1c1712", fontSize: 13, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: "#1c1712" },
  sheetWrap: { flex: 1, justifyContent: "flex-end" },
  backdrop: { flex: 1, backgroundColor: "rgba(28, 23, 18, 0.28)" },
  sheet: { height: "72%", backgroundColor: "#fffaf3", borderTopLeftRadius: 12, borderTopRightRadius: 12, borderWidth: 1, borderColor: "#e2d5c3" },
  chatLog: { padding: 16, gap: 16 },
  message: { gap: 8 },
  bubble: { backgroundColor: "#fffaf3", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#e2d5c3" },
  userBubble: { backgroundColor: "#1e4636", borderRadius: 12, padding: 16, alignSelf: "flex-end" },
  userText: { fontFamily: SANS, color: "#f6f1e7", fontSize: 15, lineHeight: 22 },
  trace: { fontFamily: SANS, color: "#645c52", fontSize: 13, borderWidth: 1, borderColor: "#e2d5c3", borderRadius: 8, padding: 8, backgroundColor: "#fffaf3" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  prompts: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  composer: { flexDirection: "row", gap: 8, padding: 16, alignItems: "center", borderTopWidth: 1, borderColor: "#e2d5c3" },
});
