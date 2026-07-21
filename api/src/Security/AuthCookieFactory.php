<?php

namespace App\Security;

use Symfony\Component\HttpFoundation\Cookie;

/**
 * Fabrique du cookie HttpOnly `auth_token` portant le JWT. Partagée entre la
 * connexion (JWTAuthenticationSuccessListener) et l'inscription (auto-login),
 * pour garantir une politique de cookie unique (secure, SameSite, TTL).
 */
class AuthCookieFactory
{
    public function __construct(
        private readonly int $tokenTtl,
        private readonly bool $secureCookie = true,
        private readonly string $cookieDomain = '',
    ) {
    }

    public function create(string $jwt): Cookie
    {
        $cookie = Cookie::create('auth_token')
            ->withValue($jwt)
            ->withHttpOnly(true)
            ->withSecure($this->secureCookie)
            ->withSameSite('lax')
            ->withPath('/')
            ->withExpires(time() + $this->tokenTtl);

        if ($this->cookieDomain !== '') {
            $cookie = $cookie->withDomain($this->cookieDomain);
        }

        return $cookie;
    }
}
