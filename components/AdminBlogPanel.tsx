"use client";

import { useState, useRef, useCallback } from "react";
import {
  Plus, Edit3, Trash2, Eye, Globe, EyeOff, Star, StarOff,
  Upload, X, Check, AlertTriangle, Image as ImageIcon,
  ArrowUpRight, Calendar, Tag, Save, ChevronLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Post {
  id:           string;
  slug:         string;
  title:        string;
  category:     string | null;
  published:    boolean;
  featured:     boolean;
  published_at: string | null;
  cover_url:    string | null;
  created_at:   string;
}

interface PostFull extends Post {
  excerpt:      string | null;
  content:      string;
  tags:         string[];
  author_name:  string | null;
  author_avatar:string | null;
}

const CATEGORIES = ["Blog", "Industry", "Product update", "Tips & guides", "Case study", "News", "Publication"];

const BLANK: Omit<PostFull, "id" | "created_at"> = {
  slug: "", title: "", excerpt: null, content: "",
  cover_url: null, category: "Blog", tags: [],
  author_name: "Swiftscope", author_avatar: null,
  published: false, featured: false, published_at: null,
};

export default function AdminBlogPanel({ posts: initialPosts }: { posts: Post[] }) {
  const supabase  = createClient();
  const [posts,   setPosts]   = useState<Post[]>(initialPosts);
  const [view,    setView]    = useState<"list" | "edit">("list");
  const [editing, setEditing] = useState<PostFull | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [tagInput,  setTagInput]  = useState("");
  const coverRef  = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  function toast(text: string, ok = true) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  }

  function slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  /* ── Load full post for editing ─────────────────────────────── */
  async function openEdit(id: string | null) {
    if (!id) {
      setEditing({ ...BLANK, id: "", created_at: "" });
      setView("edit");
      return;
    }
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("id", id)
      .single();
    if (data) { setEditing(data as PostFull); setView("edit"); }
  }

  /* ── Image upload ────────────────────────────────────────────── */
  async function uploadImage(file: File, type: "cover" | "avatar"): Promise<string | null> {
    setUploading(true);
    const ext  = file.name.split(".").pop();
    const path = `blog/${Date.now()}-${type}.${ext}`;
    const { error } = await supabase.storage.from("blog-images").upload(path, file, { upsert: true });
    if (error) { toast("Image upload failed", false); setUploading(false); return null; }
    const { data: { publicUrl } } = supabase.storage.from("blog-images").getPublicUrl(path);
    setUploading(false);
    return publicUrl;
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !editing) return;
    const url = await uploadImage(file, "cover");
    if (url) setEditing(p => ({ ...p!, cover_url: url }));
    e.target.value = "";
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !editing) return;
    const url = await uploadImage(file, "avatar");
    if (url) setEditing(p => ({ ...p!, author_avatar: url }));
    e.target.value = "";
  }

  /* ── Save post ───────────────────────────────────────────────── */
  async function save(publish?: boolean) {
    if (!editing) return;
    setSaving(true);

    const payload = {
      slug:          editing.slug || slugify(editing.title),
      title:         editing.title,
      excerpt:       editing.excerpt || null,
      content:       editing.content,
      cover_url:     editing.cover_url || null,
      category:      editing.category || "Blog",
      tags:          editing.tags,
      author_name:   editing.author_name || "Swiftscope",
      author_avatar: editing.author_avatar || null,
      published:     publish ?? editing.published,
      featured:      editing.featured,
      published_at:  (publish ?? editing.published) && !editing.published_at
        ? new Date().toISOString()
        : editing.published_at,
      updated_at:    new Date().toISOString(),
    };

    if (editing.id) {
      const { error } = await supabase.from("blog_posts").update(payload).eq("id", editing.id);
      if (error) { toast(error.message, false); setSaving(false); return; }
      setPosts(prev => prev.map(p => p.id === editing.id ? { ...p, ...payload } : p));
      toast(publish ? "Post published" : "Post saved");
    } else {
      const { data, error } = await supabase.from("blog_posts").insert(payload).select().single();
      if (error) { toast(error.message, false); setSaving(false); return; }
      setPosts(prev => [data as Post, ...prev]);
      setEditing(prev => ({ ...prev!, id: data.id }));
      toast("Post created");
    }

    setSaving(false);
    if (publish) setView("list");
  }

  /* ── Toggle published ────────────────────────────────────────── */
  async function togglePublished(id: string, current: boolean) {
    const next = !current;
    await supabase.from("blog_posts").update({
      published: next,
      published_at: next ? new Date().toISOString() : null,
    }).eq("id", id);
    setPosts(prev => prev.map(p => p.id === id ? { ...p, published: next } : p));
    toast(next ? "Published" : "Unpublished");
  }

  /* ── Toggle featured ─────────────────────────────────────────── */
  async function toggleFeatured(id: string, current: boolean) {
    // Only one featured post at a time
    if (!current) {
      await supabase.from("blog_posts").update({ featured: false }).neq("id", id);
      setPosts(prev => prev.map(p => ({ ...p, featured: p.id === id ? true : false })));
    } else {
      await supabase.from("blog_posts").update({ featured: false }).eq("id", id);
      setPosts(prev => prev.map(p => p.id === id ? { ...p, featured: false } : p));
    }
    toast(current ? "Removed from featured" : "Set as featured");
  }

  /* ── Delete post ─────────────────────────────────────────────── */
  async function deletePost(id: string) {
    setDeleting(id);
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (!error) {
      setPosts(prev => prev.filter(p => p.id !== id));
      toast("Post deleted");
      if (editing?.id === id) setView("list");
    } else {
      toast(error.message, false);
    }
    setDeleting(null);
  }

  /* ── Tag management ──────────────────────────────────────────── */
  function addTag() {
    const tag = tagInput.trim();
    if (!tag || !editing || editing.tags.includes(tag)) { setTagInput(""); return; }
    setEditing(p => ({ ...p!, tags: [...p!.tags, tag] }));
    setTagInput("");
  }

  /* ════════════════════════════════════════════════════════════════
     RENDER: List view
  ════════════════════════════════════════════════════════════════ */
  if (view === "list") return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[1.8rem] text-[var(--ink)]">Blog & Publications</h1>
          <p className="text-[13.5px] text-[var(--ink-soft)] mt-0.5">{posts.length} posts total</p>
        </div>
        <button onClick={() => openEdit(null)} className="btn-primary flex items-center gap-1.5">
          <Plus size={14} /> New post
        </button>
      </div>

      {/* Toast */}
      {msg && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold ${msg.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg.ok ? <Check size={14} /> : <AlertTriangle size={14} />} {msg.text}
        </div>
      )}

      {posts.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-[15px] font-semibold text-[var(--ink-soft)] mb-1">No posts yet</p>
          <p className="text-[13px] text-[var(--ink-faint)]">Create your first blog post or publication.</p>
        </div>
      )}

      <div className="space-y-2">
        {posts.map(post => (
          <div key={post.id} className="card flex items-center gap-4">
            {/* Thumbnail */}
            <div className="w-16 h-12 rounded-xl overflow-hidden bg-[var(--app-bg)] shrink-0">
              {post.cover_url
                ? <img src={post.cover_url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={16} className="text-[var(--ink-faint)]" /></div>}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-[14px] text-[var(--ink)] truncate">{post.title}</p>
                {post.featured && <Star size={12} className="text-[var(--amber-deep)] shrink-0" />}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {post.category && <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-faint)]">{post.category}</span>}
                {post.published_at && (
                  <span className="text-[11px] text-[var(--ink-faint)] flex items-center gap-1">
                    <Calendar size={9} />
                    {new Date(post.published_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${post.published ? "bg-green-50 text-green-700" : "bg-[var(--app-bg)] text-[var(--ink-faint)]"}`}>
                  {post.published ? "Published" : "Draft"}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {post.published && (
                <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer"
                  className="text-[var(--ink-faint)] hover:text-[var(--navy)] p-1.5 rounded-lg hover:bg-[var(--app-bg)] transition-colors">
                  <ArrowUpRight size={14} />
                </a>
              )}
              <button
                onClick={() => toggleFeatured(post.id, post.featured)}
                title={post.featured ? "Remove featured" : "Set as featured"}
                className="text-[var(--ink-faint)] hover:text-[var(--amber-deep)] p-1.5 rounded-lg hover:bg-[var(--app-bg)] transition-colors">
                {post.featured ? <Star size={14} className="text-[var(--amber-deep)]" /> : <StarOff size={14} />}
              </button>
              <button
                onClick={() => togglePublished(post.id, post.published)}
                title={post.published ? "Unpublish" : "Publish"}
                className="text-[var(--ink-faint)] hover:text-[var(--navy)] p-1.5 rounded-lg hover:bg-[var(--app-bg)] transition-colors">
                {post.published ? <Globe size={14} className="text-green-600" /> : <EyeOff size={14} />}
              </button>
              <button onClick={() => openEdit(post.id)} className="btn-secondary text-[12px] py-1.5 px-3">
                <Edit3 size={12} /> Edit
              </button>
              <button
                onClick={() => deletePost(post.id)}
                disabled={deleting === post.id}
                className="text-[var(--ink-faint)] hover:text-[var(--red)] p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ════════════════════════════════════════════════════════════════
     RENDER: Edit view
  ════════════════════════════════════════════════════════════════ */
  if (!editing) return null;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => setView("list")} className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink-soft)] hover:text-[var(--navy)]">
          <ChevronLeft size={15} /> All posts
        </button>
        <div className="flex gap-2">
          <button onClick={() => save()} disabled={saving || !editing.title}
            className="btn-secondary text-[12.5px] py-2 px-4 flex items-center gap-1.5">
            <Save size={13} /> {saving ? "Saving..." : "Save draft"}
          </button>
          <button onClick={() => save(true)} disabled={saving || !editing.title}
            className="btn-primary text-[12.5px] py-2 px-4 flex items-center gap-1.5">
            <Globe size={13} /> Publish
          </button>
        </div>
      </div>

      {/* Toast */}
      {msg && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold ${msg.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg.ok ? <Check size={14} /> : <AlertTriangle size={14} />} {msg.text}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_300px] gap-5 items-start">

        {/* ── Main content ─────────────────────────────────── */}
        <div className="space-y-4">
          {/* Cover image */}
          <div className="card space-y-3">
            <p className="section-tag">Cover image</p>
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
            {editing.cover_url ? (
              <div className="relative rounded-xl overflow-hidden aspect-[16/7]">
                <img src={editing.cover_url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setEditing(p => ({ ...p!, cover_url: null }))}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 border-0">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button onClick={() => coverRef.current?.click()} disabled={uploading}
                className="w-full border-2 border-dashed border-[var(--line)] rounded-xl py-10 flex flex-col items-center gap-2 hover:border-[var(--amber)] transition-colors bg-[var(--app-bg)]">
                <Upload size={20} className="text-[var(--ink-faint)]" />
                <span className="text-[13px] font-semibold text-[var(--ink-soft)]">
                  {uploading ? "Uploading..." : "Upload cover image"}
                </span>
                <span className="text-[11.5px] text-[var(--ink-faint)]">JPG, PNG, WebP recommended 1200x630px</span>
              </button>
            )}
          </div>

          {/* Title */}
          <div className="card space-y-2">
            <label className="text-[11px] font-bold uppercase text-[var(--ink-faint)]">Title</label>
            <input
              value={editing.title}
              onChange={e => {
                const title = e.target.value;
                setEditing(p => ({
                  ...p!,
                  title,
                  slug: p!.slug || slugify(title),
                }));
              }}
              placeholder="Post title..."
              className="w-full text-[1.3rem] font-bold text-[var(--ink)] bg-transparent border-0 focus:outline-none placeholder:text-[var(--ink-faint)] placeholder:font-normal"
            />
          </div>

          {/* Excerpt */}
          <div className="card space-y-2">
            <label className="text-[11px] font-bold uppercase text-[var(--ink-faint)]">Excerpt / summary</label>
            <textarea
              value={editing.excerpt ?? ""}
              onChange={e => setEditing(p => ({ ...p!, excerpt: e.target.value }))}
              rows={3}
              placeholder="A short description shown in the blog listing..."
              className="app-field text-[13.5px] resize-none"
            />
          </div>

          {/* Content */}
          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase text-[var(--ink-faint)]">Content (Markdown supported)</label>
              <span className="text-[10.5px] text-[var(--ink-faint)]">
                # H1 &nbsp;## H2 &nbsp;**bold** &nbsp;*italic* &nbsp;[link](url) &nbsp;![alt](img-url)
              </span>
            </div>
            <textarea
              value={editing.content}
              onChange={e => setEditing(p => ({ ...p!, content: e.target.value }))}
              rows={24}
              placeholder="Write your post content here...

# Main heading

Start writing. You can use **bold**, *italic*, and [links](https://example.com).

## Sub heading

Add images with ![alt text](https://example.com/image.jpg)"
              className="app-field text-[13.5px] font-mono resize-y"
            />
          </div>
        </div>

        {/* ── Sidebar ──────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Status */}
          <div className="card space-y-3">
            <p className="section-tag">Status</p>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${editing.published ? "bg-green-500" : "bg-[var(--ink-faint)]"}`} />
              <span className="text-[13px] font-semibold text-[var(--ink)]">
                {editing.published ? "Published" : "Draft"}
              </span>
            </div>
            {editing.published_at && (
              <p className="text-[12px] text-[var(--ink-faint)]">
                Published {new Date(editing.published_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editing.featured} onChange={e => setEditing(p => ({ ...p!, featured: e.target.checked }))}
                className="w-4 h-4 accent-[var(--navy)]" />
              <span className="text-[13px] font-semibold text-[var(--ink)]">Featured post</span>
            </label>
          </div>

          {/* Slug */}
          <div className="card space-y-2">
            <label className="text-[11px] font-bold uppercase text-[var(--ink-faint)]">URL slug</label>
            <div className="flex items-center gap-1 text-[12px] text-[var(--ink-faint)] bg-[var(--app-bg)] rounded-lg px-2 py-1.5">
              <span>swiftscope.com.au/blog/</span>
            </div>
            <input
              value={editing.slug}
              onChange={e => setEditing(p => ({ ...p!, slug: slugify(e.target.value) }))}
              placeholder="post-url-slug"
              className="app-field text-[13px] font-mono"
            />
          </div>

          {/* Category */}
          <div className="card space-y-2">
            <label className="text-[11px] font-bold uppercase text-[var(--ink-faint)]">Category</label>
            <select value={editing.category ?? "Blog"} onChange={e => setEditing(p => ({ ...p!, category: e.target.value }))}
              className="app-field text-[13px]">
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* Tags */}
          <div className="card space-y-2">
            <label className="text-[11px] font-bold uppercase text-[var(--ink-faint)]">Tags</label>
            <div className="flex gap-1.5 flex-wrap">
              {editing.tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 text-[11.5px] font-semibold bg-[var(--app-bg)] border border-[var(--line)] px-2 py-1 rounded-full text-[var(--ink-soft)]">
                  {tag}
                  <button onClick={() => setEditing(p => ({ ...p!, tags: p!.tags.filter(t => t !== tag) }))} className="border-0 bg-transparent p-0 leading-none">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Add tag..."
                className="app-field flex-1 text-[12.5px] py-1.5" />
              <button onClick={addTag} className="btn-secondary text-[12px] py-1.5 px-2.5">
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* Author */}
          <div className="card space-y-3">
            <p className="section-tag">Author</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--app-bg)] border border-[var(--line)] shrink-0 flex items-center justify-center">
                {editing.author_avatar
                  ? <img src={editing.author_avatar} alt="" className="w-full h-full object-cover" />
                  : <span className="text-[16px] font-bold text-[var(--ink-faint)]">{(editing.author_name ?? "S")[0]}</span>}
              </div>
              <div className="flex-1">
                <input
                  value={editing.author_name ?? ""}
                  onChange={e => setEditing(p => ({ ...p!, author_name: e.target.value }))}
                  placeholder="Author name"
                  className="app-field text-[13px]"
                />
              </div>
            </div>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            <button onClick={() => avatarRef.current?.click()} disabled={uploading}
              className="btn-secondary text-[12px] py-1.5 w-full flex items-center justify-center gap-1.5">
              <Upload size={12} /> {uploading ? "Uploading..." : "Upload author photo"}
            </button>
          </div>

          {/* Preview link */}
          {editing.id && editing.slug && (
            <a href={`/blog/${editing.slug}`} target="_blank" rel="noreferrer"
              className="btn-secondary w-full text-[12.5px] py-2 flex items-center justify-center gap-1.5">
              <Eye size={13} /> Preview post <ArrowUpRight size={11} />
            </a>
          )}

          {/* Delete */}
          {editing.id && (
            <button
              onClick={() => { if (confirm("Delete this post permanently?")) deletePost(editing.id); }}
              className="w-full text-[12px] font-semibold text-[var(--red)] hover:bg-red-50 rounded-xl py-2 border border-red-100 transition-colors">
              <Trash2 size={12} className="inline mr-1" /> Delete post
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
