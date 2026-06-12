'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Loader2, User, Lock, Shield } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import type { Profile } from '@/types/database'

const profileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(6, 'Senha atual obrigatória'),
  newPassword: z.string().min(6, 'Nova senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

type ProfileFormData = z.infer<typeof profileSchema>
type PasswordFormData = z.infer<typeof passwordSchema>

export function ProfileSettings({ profile }: { profile: Profile | null }) {
  const router = useRouter()
  const supabase = createClient()
  const [updatingProfile, setUpdatingProfile] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)

  const { register: registerProfile, handleSubmit: handleProfileSubmit, formState: { errors: profileErrors } } =
    useForm<ProfileFormData>({
      resolver: zodResolver(profileSchema),
      defaultValues: { name: profile?.name ?? '' },
    })

  const { register: registerPassword, handleSubmit: handlePasswordSubmit, reset: resetPassword, formState: { errors: passwordErrors } } =
    useForm<PasswordFormData>({ resolver: zodResolver(passwordSchema) })

  const initials = profile?.name
    ?.split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? 'U'

  const handleProfileUpdate = async (data: ProfileFormData) => {
    setUpdatingProfile(true)
    try {
      const { error } = await (supabase.from('profiles') as any)
        .update({ name: data.name })
        .eq('id', profile?.id ?? '')
      if (error) throw error
      toast.success('Perfil atualizado!')
      router.refresh()
    } catch {
      toast.error('Erro ao atualizar perfil')
    } finally {
      setUpdatingProfile(false)
    }
  }

  const handlePasswordUpdate = async (data: PasswordFormData) => {
    setUpdatingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: data.newPassword })
      if (error) throw error
      toast.success('Senha alterada com sucesso!')
      resetPassword()
    } catch {
      toast.error('Erro ao alterar senha')
    } finally {
      setUpdatingPassword(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 2MB')
      return
    }
    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `avatars/${profile?.id}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error } = await (supabase.from('profiles') as any).update({ avatar_url: publicUrl }).eq('id', profile?.id ?? '')
      if (error) throw error

      toast.success('Foto atualizada!')
      router.refresh()
    } catch {
      toast.error('Erro ao fazer upload da foto')
    } finally {
      setAvatarUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" />
            Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="w-16 h-16">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="text-lg bg-primary text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
              {avatarUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                </div>
              )}
            </div>
            <div>
              <p className="font-medium">{profile?.name}</p>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {profile?.role === 'admin' ? 'Administrador' : 'Operador'}
                </Badge>
              </div>
              <label htmlFor="avatar-upload">
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={avatarUploading}
                />
                <Button variant="outline" size="sm" className="mt-2 cursor-pointer" asChild>
                  <span>Alterar foto</span>
                </Button>
              </label>
            </div>
          </div>

          <Separator />

          <form onSubmit={handleProfileSubmit(handleProfileUpdate)} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input {...registerProfile('name')} className={profileErrors.name ? 'border-destructive' : ''} />
              {profileErrors.name && <p className="text-xs text-destructive">{profileErrors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={profile?.email ?? ''} disabled className="bg-muted" />
            </div>
            <Button type="submit" disabled={updatingProfile} size="sm">
              {updatingProfile ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : 'Salvar Perfil'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Alterar Senha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit(handlePasswordUpdate)} className="space-y-4">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                {...registerPassword('newPassword')}
                className={passwordErrors.newPassword ? 'border-destructive' : ''}
              />
              {passwordErrors.newPassword && <p className="text-xs text-destructive">{passwordErrors.newPassword.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Confirmar Nova Senha</Label>
              <Input
                type="password"
                placeholder="Repita a nova senha"
                {...registerPassword('confirmPassword')}
                className={passwordErrors.confirmPassword ? 'border-destructive' : ''}
              />
              {passwordErrors.confirmPassword && <p className="text-xs text-destructive">{passwordErrors.confirmPassword.message}</p>}
            </div>
            <Button type="submit" disabled={updatingPassword} size="sm">
              {updatingPassword ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Alterando...</> : 'Alterar Senha'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aparência</CardTitle>
          <CardDescription>Escolha o tema da interface</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm">Tema Claro / Escuro</p>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      {/* Security Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>✓ Autenticação gerenciada pelo Supabase Auth</p>
          <p>✓ Senhas com hash seguro</p>
          <p>✓ Proteção por Row Level Security (RLS)</p>
          <p>✓ Sessão persistente com renovação automática</p>
          <p>✓ Dados isolados por usuário</p>
        </CardContent>
      </Card>
    </div>
  )
}
