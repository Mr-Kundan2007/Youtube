import React from "react"
import { GetServerSideProps } from "next"
import Head from "next/head"
import { useRouter } from "next/router"
import SearchResult from "@/components/SearchResult"

interface SearchPageProps {
  initialQuery: string
}

export default function SearchPage({ initialQuery }: SearchPageProps) {
  const router = useRouter()
  const q = router.query.q
  const currentQuery =
    (Array.isArray(q) ? q[0] : q) ?? initialQuery ?? ""

  return (
    <>
      <Head>
        <title>
          {currentQuery ? `${currentQuery} - YouTube` : "Search - YouTube"}
        </title>
      </Head>
      <div className="bg-[var(--background)] text-[var(--foreground)] min-h-screen">
        <SearchResult query={currentQuery} />
      </div>
    </>
  )
}

export const getServerSideProps: GetServerSideProps<SearchPageProps> = async (
  context
) => {
  const query = context.query.q || ""
  const initialQuery = Array.isArray(query) ? query[0] : query

  return {
    props: {
      initialQuery,
    },
  }
}
